import { ACCOUNTS } from './your_accounts.js';
import type { AccountMapping } from './your_accounts.d.ts';

export type { AccountMapping };

export function getAccountForTransaction(accountId: string): AccountMapping | null {
  return ACCOUNTS.find(
    a => a.provider_account_id === accountId || a.id === accountId,
  ) ?? null;
}
