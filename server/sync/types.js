/**
 * @typedef {Object} SyncResult
 * @property {boolean} success
 * @property {string} message
 * @property {number} [pid]
 * @property {string} [provider]
 */

/**
 * @typedef {Object} SyncProviderInfo
 * @property {string} id
 * @property {string} name
 * @property {string} description
 */

/**
 * @typedef {SyncProviderInfo & {
 *   launch: () => Promise<SyncResult>
 * }} SyncProvider
 */

export {};
