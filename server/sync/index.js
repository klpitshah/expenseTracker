import { originProvider } from './providers/origin.js';
import { plaidProvider } from './providers/plaid.js';

/** @type {Record<string, import('./types.js').SyncProvider>} */
const providers = {
  [originProvider.id]: originProvider,
  [plaidProvider.id]: plaidProvider,
};

export function listProviders() {
  return Object.values(providers).map(({ id, name, description }) => ({
    id,
    name,
    description,
  }));
}

export function getActiveProviderId() {
  const id = process.env.SYNC_PROVIDER || 'origin';
  if (!providers[id]) {
    throw new Error(`Unknown SYNC_PROVIDER "${id}". Available: ${Object.keys(providers).join(', ')}`);
  }
  return id;
}

export function getProvider(id) {
  const provider = providers[id];
  if (!provider) {
    throw new Error(`Unknown sync provider "${id}". Available: ${Object.keys(providers).join(', ')}`);
  }
  return provider;
}

/** @param {string} [providerId] */
export async function launchSync(providerId) {
  const id = providerId || getActiveProviderId();
  const provider = getProvider(id);
  console.log(`Starting sync via ${provider.name} (${provider.id})...`);
  const result = await provider.launch();
  return { ...result, provider: provider.id };
}
