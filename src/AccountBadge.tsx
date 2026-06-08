import { getAccountForTransaction } from './accounts';

interface AccountBadgeProps {
  accountId: string;
  compact?: boolean;
}

export function AccountBadge({ accountId, compact = false }: AccountBadgeProps) {
  const account = getAccountForTransaction(accountId);

  if (!account) {
    return compact ? null : <span className="account-badge account-badge-unknown">—</span>;
  }

  return (
    <span className={`account-badge${compact ? ' account-badge-compact' : ''}`} title={account.name}>
      <span className="material-symbols-outlined account-badge-icon" aria-hidden="true">
        {account.icon}
      </span>
      {!compact && <span className="account-badge-name">{account.name}</span>}
    </span>
  );
}
