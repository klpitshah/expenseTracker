# Expense Tracker

A local-first expense tracking app. Run it on your machine—no cloud deployment. You get the source, install dependencies, and run both the frontend and backend locally.

## Prerequisites

- **Node.js** (v18 or newer; needed for frontend and backend)
- **npm** (comes with Node)

## Quick start (recommended)

1. **Clone and install**
   ```bash
   cd expenseTracker
   npm install
   cd server && npm install && cd ..
   ```

2. **Open the helper page**  
   Double-click **`start-helper.html`** in Finder (or open it in your browser).

3. **Use the helper page**
   - Click **Start servers** to run the backend (port 3001) and frontend (port 5173).
   - macOS may open Terminal briefly to run the companion script in this folder.
   - Wait a few seconds, then click **Open app →** (or go to http://localhost:5173).
   - When you’re done, click **Stop servers** on the helper page.

You can also double-click **`Start Expense Tracker.command`** or **`Stop Expense Tracker.command`** directly, or run `npm start` / `npm run stop` from a terminal.

## Manual start (two terminals)

If you prefer not to use the helper page:

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
- `server/` – Express API and `server/data/` for local data
- `launcher.mjs` – Starts and stops the backend and frontend processes
- `start-helper.html` – Helper page UI (open directly in your browser)
- `Start Expense Tracker.command` / `Stop Expense Tracker.command` – macOS shortcuts used by the helper page

## Data

Transaction data is stored under `server/data/`. The file `transactions.json` is gitignored so your own data is not committed. For a fresh clone, the server will create an empty data file when it first runs.

## License

MIT (or your chosen license)
