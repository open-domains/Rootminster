const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Short human countdown to a future time, e.g. "in 12 days, 4 hours" or "due now".
export function describeCountdown(target, now = Date.now()) {
  const remaining = new Date(target).getTime() - new Date(now).getTime();
  if (!Number.isFinite(remaining)) return '—';
  if (remaining <= 0) return 'Due on the next run';
  const days = Math.floor(remaining / DAY);
  const hours = Math.floor((remaining % DAY) / HOUR);
  const minutes = Math.max(1, Math.floor((remaining % HOUR) / MINUTE));
  const unit = (value, name) => `${value} ${name}${value === 1 ? '' : 's'}`;
  if (days > 0) return `in ${unit(days, 'day')}${hours ? `, ${unit(hours, 'hour')}` : ''}`;
  if (hours > 0) return `in ${unit(hours, 'hour')}`;
  return `in ${unit(minutes, 'minute')}`;
}
