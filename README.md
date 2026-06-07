# Expense Tracker

A local-first expense tracking app. Run it on your machine—no cloud deployment. You get the source, install dependencies, and run both the frontend and backend locally.

## Prerequisites

- **Node.js** (v18 or newer; needed for frontend and backend)
- **npm** (comes with Node)

## Quick start

1. **Clone and install**
   ```bash
   cd expenseTracker
   npm install
   cd server && npm install && cd ..
   ```

2. **Set your personal numbers** (income and savings targets used for Spending Power)
   ```bash
   cp src/your_numbers.example.js src/your_numbers.js
   ```
   Then edit `src/your_numbers.js`:
   - `INCOME_THAT_HITS_ACCOUNT` — monthly income that hits your account
   - `FIXED_MUST_SAVINGS` — amount you must save each month

   This file is gitignored so your numbers stay local.

3. **Start the app**
   ```bash
   npm start
   ```

   Open **http://localhost:5173** in your browser.

4. **Stop when done**
   ```bash
   npm stop
   ```

## Manual start (two terminals)

If you prefer separate terminals:

**Terminal 1 – backend**
```bash
npm run server
```

**Terminal 2 – frontend**
```bash
npm run dev
```

Then open **http://localhost:5173** in your browser.

## Ports

| Service   | URL                     |
|----------|--------------------------|
| App (UI) | http://localhost:5173    |
| API      | http://localhost:3001   |

## Project layout

- `src/` – React frontend (Vite + TypeScript)
- `src/your_numbers.js` – your income/savings values (copy from `your_numbers.example.js`)
- `server/` – Express API and `server/data/` for local data
- `server/sync/` – pluggable transaction sync providers (Origin, Plaid stub, etc.)
- `scripts/` – Origin browser sync script (Python + Selenium)
- `launcher.mjs` – starts and stops the backend and frontend (`npm start` / `npm stop`)

## Data

Transaction data is stored under `server/data/`. The file `transactions.json` and uploaded `documents/` are gitignored so your own data is not committed. For a fresh clone, the server will create an empty data file when it first runs.

## Syncing transactions

Use **Sync from Origin** in the app to import transactions from Origin Financial. The active sync provider is set via the `SYNC_PROVIDER` env var (defaults to `origin`).

To set up the Origin sync script:
```bash
cd scripts
python3 -m venv venv
source venv/bin/activate
pip install selenium selenium-wire requests
```

## License

MIT (or your chosen license)
