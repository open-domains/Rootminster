export function displayText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value || fallback;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? fallback : value.toISOString();
  if (typeof value === 'object' && typeof value.message === 'string') return value.message || fallback;
  return fallback;
}

export function initialText(primary, secondary, fallback = '?') {
  const text = displayText(primary) || displayText(secondary);
  return text ? text.charAt(0).toUpperCase() : fallback;
}
