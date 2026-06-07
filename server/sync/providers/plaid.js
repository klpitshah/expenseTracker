/** @type {import('../types.js').SyncProvider} */
export const plaidProvider = {
  id: 'plaid',
  name: 'Plaid',
  description: 'Sync transactions via Plaid API',

  async launch() {
    throw new Error('Plaid sync is not yet implemented. Set SYNC_PROVIDER=origin to use Origin.');
  },
};
