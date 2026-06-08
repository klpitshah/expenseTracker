/** @type {import('./your_accounts.d.ts').AccountMapping[]} */
export const ACCOUNTS = [
  {
    id: 'origin-account-id-1',
    provider_account_id: 'plaid-account-id-1',
    name: 'Checking',
    icon: 'account_balance',
  },
  {
    id: 'origin-account-id-2',
    provider_account_id: 'plaid-account-id-2',
    name: 'Credit Card',
    icon: 'credit_card',
  },
  {
    id: 'manual',
    provider_account_id: 'manual',
    name: 'Manual',
    icon: 'edit_note',
  },
]
