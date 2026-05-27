import {
  formatDisplayDate,
  getDaysUntil,
  getExpirationStatus,
} from '../../lib/dates';

interface ExpirationBadgeProps {
  expirationDate: string | null;
}

export default function ExpirationBadge({ expirationDate }: ExpirationBadgeProps) {
  const status = getExpirationStatus(expirationDate);

  if (status === 'no_expiration' || !expirationDate) {
    return (
      <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300">
        No expiration
      </span>
    );
  }

  const days = getDaysUntil(expirationDate);
  const styles = {
    expired: 'bg-red-500/15 text-red-200 border-red-500/25',
    today: 'bg-red-500/15 text-red-200 border-red-500/25',
    soon: 'bg-orange-500/15 text-orange-200 border-orange-500/25',
    month: 'bg-yellow-500/15 text-yellow-100 border-yellow-500/25',
    safe: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/25',
  }[status];

  let label = formatDisplayDate(expirationDate);

  if (days < 0) {
    label = `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  } else if (days === 0) {
    label = 'Expires today';
  } else if (days <= 30) {
    label = `${days} day${days === 1 ? '' : 's'} left`;
  }

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${styles}`}>
      {label}
    </span>
  );
}
