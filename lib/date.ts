/** Local YYYY-MM-DD key for a date (defaults to now). */
export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** dateKey for `n` days before today (n=1 → yesterday). */
export function dateKeyDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateKey(d);
}

/** Last `count` dateKeys, oldest first, ending today. */
export function recentDateKeys(count: number): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) keys.push(dateKeyDaysAgo(i));
  return keys;
}

/** Whether key `a` is exactly one calendar day after key `b`. */
export function isNextDay(a: string, b: string): boolean {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  // round() not floor() — a DST day is 23h or 25h, and 23/24 or 25/24 still round to 1.
  return Math.round((da.getTime() - db.getTime()) / 86_400_000) === 1;
}

/** Short label like "Mon 22" for a dateKey. */
export function shortLabel(key: string): string {
  const d = new Date(key + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
}
