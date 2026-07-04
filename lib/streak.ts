import { dateKey, isNextDay } from './date';
import { DEFAULT_STREAK, Streak } from './types';

/**
 * Pure streak update. Given the prior streak and the dateKey just logged,
 * returns the new streak. Logging multiple times the same day is a no-op for
 * the count; logging the next consecutive day increments; a gap resets to 1.
 */
export function recomputeStreak(prev: Streak, loggedKey: string = dateKey()): Streak {
  const last = prev.lastLoggedDate;

  let current: number;
  if (last === loggedKey) {
    current = prev.current; // already counted today
  } else if (last && isNextDay(loggedKey, last)) {
    current = prev.current + 1;
  } else {
    current = 1; // first log ever, or a gap broke the streak
  }

  return {
    current,
    longest: Math.max(prev.longest, current),
    lastLoggedDate: loggedKey,
  };
}

/**
 * Live streak count for display. The stored `current` only changes on add/delete, so
 * after a missed day it's stale (still shows the old number until the next log). This
 * derives the truthful value: the stored count holds only while the last log was today
 * or yesterday; any older (or absent/future) means the streak is already broken → 0.
 */
export function currentStreak(s: Streak, today: string = dateKey()): number {
  if (!s.lastLoggedDate) return 0;
  if (s.lastLoggedDate === today || isNextDay(today, s.lastLoggedDate)) return s.current;
  return 0;
}

/**
 * Rebuild the whole streak from the set of logged dateKeys — used after a delete,
 * where the incremental path can't run. Replays recomputeStreak over the sorted
 * unique days so results match the add path exactly. Empty → reset.
 */
export function recomputeStreakFromKeys(keys: string[]): Streak {
  const unique = Array.from(new Set(keys)).sort();
  return unique.reduce<Streak>((acc, k) => recomputeStreak(acc, k), DEFAULT_STREAK);
}
