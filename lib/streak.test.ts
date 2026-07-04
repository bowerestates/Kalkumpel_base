import assert from 'node:assert';

import { currentStreak, recomputeStreak, recomputeStreakFromKeys } from './streak';
import { dateKeyDaysAgo } from './date';
import { DEFAULT_STREAK, Streak } from './types';

// Runnable self-check for the streak logic (the branchiest path in the app).
// Run: npx tsx lib/streak.test.ts

// First log ever → current 1.
let s = recomputeStreak(DEFAULT_STREAK, '2026-01-01');
assert.equal(s.current, 1);
assert.equal(s.longest, 1);

// Same day again → no double count.
s = recomputeStreak(s, '2026-01-01');
assert.equal(s.current, 1);

// Next consecutive day → increment.
s = recomputeStreak(s, '2026-01-02');
assert.equal(s.current, 2);
assert.equal(s.longest, 2);

// Gap → reset to 1, longest preserved.
s = recomputeStreak(s, '2026-01-05');
assert.equal(s.current, 1);
assert.equal(s.longest, 2);

// Rebuild from keys (post-delete): out-of-order, duplicate days collapse,
// trailing consecutive run wins for current.
const rebuilt = recomputeStreakFromKeys([
  '2026-02-03',
  '2026-02-01',
  '2026-02-02',
  '2026-02-02',
]);
assert.equal(rebuilt.current, 3);
assert.equal(rebuilt.longest, 3);

// Empty → reset.
assert.deepEqual(recomputeStreakFromKeys([]), DEFAULT_STREAK);

// currentStreak — derived live value for display.
const mk = (current: number, last: string | null): Streak => ({
  current,
  longest: Math.max(current, 0),
  lastLoggedDate: last,
});
// Last log today → stored count holds.
assert.equal(currentStreak(mk(5, dateKeyDaysAgo(0))), 5);
// Last log yesterday → still alive.
assert.equal(currentStreak(mk(5, dateKeyDaysAgo(1))), 5);
// Last log two days ago → broken, even though storage still says 5.
assert.equal(currentStreak(mk(5, dateKeyDaysAgo(2))), 0);
// Never logged → 0.
assert.equal(currentStreak(mk(0, null)), 0);
// Future lastLoggedDate (clock skew) → 0, self-heals on next log.
assert.equal(currentStreak(mk(5, dateKeyDaysAgo(-1))), 0);

console.log('streak self-check passed');
