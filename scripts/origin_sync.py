#!/usr/bin/env python3
"""
Origin Financial Transaction Sync via Selenium

This script:
1. Opens Origin in a browser
2. Waits for you to log in (via Apple or other method)
3. Captures the transactions API call with all headers
4. Re-calls the API with page_size=100 to get all transactions
5. Saves them to the local database

Requirements:
    pip install selenium selenium-wire requests

Usage:
    python origin_sync.py
"""

import json
import time
import requests
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

try:
    from seleniumwire import webdriver
    from selenium.webdriver.chrome.options import Options
except ImportError:
    print("""
╔══════════════════════════════════════════════════════════════════╗
║  Missing dependencies! Please install:                           ║
║                                                                  ║
║    pip install selenium selenium-wire requests                   ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
""")
    exit(1)

# Paths
SCRIPT_DIR = Path(__file__).parent
SERVER_DATA_FILE = SCRIPT_DIR.parent / "server" / "data" / "transactions.json"

# Origin URLs
ORIGIN_DASHBOARD_URL = "https://app.useorigin.com/?dashboard-tab=overview&net-worth-range=1W&net-worth-tab=all"


def setup_driver():
    """Setup Chrome with selenium-wire to capture network traffic."""
    chrome_options = Options()
    # Don't run headless - we need the user to log in
    chrome_options.add_argument("--start-maximized")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option("useAutomationExtension", False)
    
    # Selenium-wire options for capturing requests
    seleniumwire_options = {
        'disable_encoding': True,  # Don't decode responses
    }
    
    driver = webdriver.Chrome(
        options=chrome_options,
        seleniumwire_options=seleniumwire_options
    )
    
    # Make it harder to detect automation
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    
    return driver


def find_transactions_request(driver, timeout=300):
    """Wait and find the transactions API request."""
    print("\n🔍 Monitoring network requests for transactions API...")
    print("   (This will wait up to 5 minutes)\n")
    
    start_time = time.time()
    transactions_request = None
    
    while time.time() - start_time < timeout:
        for request in driver.requests:
            if request.response and 'transaction' in request.url.lower():
                # Check if it's a successful API call
                if request.response.status_code == 200:
                    content_type = request.response.headers.get('Content-Type', '')
                    if 'json' in content_type:
                        print(f"   ✅ Found: {request.url[:80]}...")
                        transactions_request = request
                        break
        
        if transactions_request:
            break
            
        time.sleep(1)
    
    return transactions_request


def extract_request_details(request):
    """Extract headers and URL details from captured request."""
    headers = {}
    for header, value in request.headers.items():
        # Skip some headers that shouldn't be copied
        if header.lower() not in ['content-length', 'host', 'connection']:
            headers[header] = value
    
    return {
        'url': request.url,
        'method': request.method,
        'headers': headers,
    }


def modify_url_params(url, new_params):
    """Modify URL query parameters."""
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    
    # Update with new params
    for key, value in new_params.items():
        params[key] = [value]
    
    # Rebuild URL
    new_query = urlencode(params, doseq=True)
    new_url = urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        new_query,
        parsed.fragment
    ))
    
    return new_url


def fetch_all_transactions(request_details):
    """Re-call the API with page_size=100."""
    print("\n📥 Fetching transactions with page_size=100...")
    
    # Modify URL to include page_size=100
    url = modify_url_params(request_details['url'], {
        'page_size': '1000',
        'limit': '1000',  # Some APIs use 'limit' instead
    })
    
    print(f"   URL: {url[:100]}...")
    
    response = requests.request(
        method=request_details['method'],
        url=url,
        headers=request_details['headers'],
    )
    
    if response.status_code != 200:
        print(f"   ❌ API returned {response.status_code}")
        print(f"   Response: {response.text[:500]}")
        return None
    
    data = response.json()
    print(f"   ✅ Got response")
    
    # Try to extract transactions array
    transactions = []
    if isinstance(data, list):
        transactions = data
    elif 'transactions' in data:
        transactions = data['transactions']
    elif 'data' in data:
        transactions = data['data'] if isinstance(data['data'], list) else []
    elif 'items' in data:
        transactions = data['items']
    else:
        # Try to find any array in the response
        for key, value in data.items():
            if isinstance(value, list) and len(value) > 0:
                transactions = value
                print(f"   Found transactions in '{key}' field")
                break
    
    print(f"   📊 Found {len(transactions)} transactions")
    return transactions


def transform_transaction(tx):
    """Transform Origin transaction to our format."""
    # Handle amount - Origin might return positive amounts for expenses
    amount = tx.get('amount', 0)
    if isinstance(amount, str):
        amount = float(amount)
    
    # Determine if it's an expense (negative) or income (positive)
    tx_type = tx.get('type', '').lower()
    if tx_type in ['withdrawal', 'expense', 'debit', 'outflow']:
        amount = -abs(amount)
    elif amount > 0 and tx_type not in ['deposit', 'income', 'credit', 'inflow']:
        # If positive but not explicitly income, might be an expense displayed as positive
        pass  # Keep as is, user can fix
    
    # Get category
    category_data = tx.get('category', {})
    if isinstance(category_data, str):
        category_data = {'detailed': category_data, 'primary': 'expense'}
    
    return {
        'id': tx.get('id') or tx.get('_id') or tx.get('transaction_id', ''),
        'user_id': tx.get('user_id', ''),
        'account_id': tx.get('account_id', ''),
        'amount': amount,
        'status': tx.get('status', 'completed'),
        'category': {
            'primary': category_data.get('primary', 'expense'),
            'detailed': category_data.get('detailed') or category_data.get('name', 'other'),
            'tags': category_data.get('tags'),
        },
        'date': tx.get('date') or tx.get('transaction_date') or tx.get('authorized_date', ''),
        'ignored_on': tx.get('ignored_on'),
        'is_recurring': tx.get('is_recurring', False),
        'type': tx.get('type', 'withdrawal'),
        'is_manual': tx.get('is_manual', False),
        'is_edited': tx.get('is_edited', False),
        'recurrence_details': tx.get('recurrence_details'),
        'logo': tx.get('logo') or tx.get('logo_url'),
        'parent_transaction_id': tx.get('parent_transaction_id'),
        'tag_ids': tx.get('tag_ids'),
        'metadata': tx.get('metadata'),
        'is_subscription': tx.get('is_subscription', False),
        'recurrence_id': tx.get('recurrence_id'),
        'review_status': 'pending',  # All imports start as pending
        'vendor': tx.get('vendor') or tx.get('merchant_name') or tx.get('merchant', {}).get('name', ''),
        'description': tx.get('description') or tx.get('original_description') or tx.get('name', ''),
        'notes': tx.get('notes', ''),
        'title': tx.get('title') or tx.get('name') or tx.get('merchant_name') or tx.get('vendor', 'Unknown'),
    }


def save_to_database(transactions):
    """Save transactions to the local JSON database."""
    print(f"\n💾 Saving to {SERVER_DATA_FILE}...")
    
    # Load existing
    existing = []
    if SERVER_DATA_FILE.exists():
        with open(SERVER_DATA_FILE) as f:
            data = json.load(f)
            existing = data.get('transactions', [])
    
    existing_ids = {t['id'] for t in existing}
    
    # Transform and filter new transactions (exclude pending - only add non-pending)
    new_transactions = []
    for tx in transactions:
        if tx.get('status') == 'pending':
            continue
        transformed = transform_transaction(tx)
        if transformed['id'] and transformed['id'] not in existing_ids:
            new_transactions.append(transformed)
    
    # Merge
    all_transactions = existing + new_transactions
    
    # Save
    SERVER_DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(SERVER_DATA_FILE, 'w') as f:
        json.dump({'transactions': all_transactions}, f, indent=2)
    
    print(f"   ✅ Imported {len(new_transactions)} new transactions")
    print(f"   📊 Total transactions: {len(all_transactions)}")
    
    return len(new_transactions)


def main():
    print("""
╔══════════════════════════════════════════════════════════════════╗
║              Origin Financial Transaction Sync                   ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  1. A browser window will open to Origin                         ║
║  2. Log in using Apple (or your preferred method)                ║
║  3. Navigate to your transactions if not auto-loaded             ║
║  4. The script will capture the API call automatically           ║
║  5. Transactions will be imported to your local database         ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
""")
    
    driver = None
    try:
        # Setup and launch browser
        print("\n🚀 Launching browser...")
        driver = setup_driver()
        
        # Navigate to Origin
        print(f"📍 Navigating to Origin dashboard...")
        driver.get(ORIGIN_DASHBOARD_URL)
        
        print("""
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║  👆 Please log in to Origin in the browser window                ║
║                                                                  ║
║  Once logged in, navigate to your transactions page.             ║
║  The script will automatically detect the API call.              ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
""")
        
        # Wait for transactions API call
        transactions_request = find_transactions_request(driver)
        
        if not transactions_request:
            print("\n❌ Could not find transactions API call.")
            print("   Please make sure you navigated to a page that loads transactions.")
            
            # Show captured URLs for debugging
            print("\n   Captured API calls:")
            for req in driver.requests[-20:]:
                if req.response and 'api' in req.url.lower():
                    print(f"   - {req.url[:80]}...")
            return
        
        # Extract request details
        request_details = extract_request_details(transactions_request)
        
        print(f"\n📋 Captured request:")
        print(f"   Method: {request_details['method']}")
        print(f"   Auth: {request_details['headers'].get('Authorization', 'None')[:50]}...")
        
        # Re-call with page_size=100
        transactions = fetch_all_transactions(request_details)
        
        if not transactions:
            print("\n❌ No transactions received from API")
            return
        
        # Save to database
        imported = save_to_database(transactions)
        
        print(f"""
╔══════════════════════════════════════════════════════════════════╗
║                         ✅ Success!                              ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  Imported {imported:>3} new transactions                               ║
║                                                                  ║
║  All imported transactions are marked as "pending"               ║
║  Open the app to review and approve them.                        ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
""")
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Keep browser open - don't auto-close so user can continue working
        pass


if __name__ == '__main__':
    main()
