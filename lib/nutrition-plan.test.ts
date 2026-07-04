import assert from 'node:assert';

import { bmrMifflin, cmToFtIn, computePlan, ftInToCm, kgToLb, lbToKg } from './nutrition-plan';
import { Profile } from './types';

// Runnable self-check for the recommended-plan math.
// Run: npx tsx lib/nutrition-plan.test.ts

const base: Profile = {
  onboarded: true,
  sex: 'male',
  age: 30,
  heightCm: 180,
  weightKg: 80,
  activity: 'moderate',
  goal: 'maintain',
  units: 'metric',
};

// BMR: 10*80 + 6.25*180 - 5*30 + 5 = 1780
assert.equal(bmrMifflin(base), 1780);
// Female constant: 1780 - 5 - 161 = 1614
assert.equal(bmrMifflin({ ...base, sex: 'female' }), 1614);

// Maintain: TDEE = 1780 * 1.55 = 2759; protein 128g, fat 77g, carbs ~389g.
const maintain = computePlan(base);
assert.equal(maintain.calories, 2759);
assert.equal(maintain.protein, 128); // 80 * 1.6
assert.equal(maintain.fat, 77); // 2759*0.25/9 = 76.6
assert.equal(maintain.floored, false);
assert.equal(maintain.compromised, false);

// Lose: 2759 - 500 = 2259; protein bumps to 2.0 g/kg = 160g.
const lose = computePlan({ ...base, goal: 'lose' });
assert.equal(lose.calories, 2259);
assert.equal(lose.protein, 160);

// Calorie floor: small sedentary female cutting falls below 1200 → clamped + flagged.
const floored = computePlan({
  ...base,
  sex: 'female',
  age: 25,
  heightCm: 160,
  weightKg: 50,
  activity: 'sedentary',
  goal: 'lose',
});
assert.equal(floored.calories, 1200);
assert.equal(floored.floored, true);

// Invariant across the goal range: carbs never negative, and macro kcal never
// exceed the calorie target by more than rounding slack.
for (const goal of ['lose', 'maintain', 'gain', 'muscle'] as const) {
  const p = computePlan({ ...base, goal });
  assert.ok(p.carbs >= 0, `carbs >= 0 for ${goal}`);
  const macroKcal = p.protein * 4 + p.carbs * 4 + p.fat * 9;
  assert.ok(Math.abs(macroKcal - p.calories) <= 8, `macros sum ~ calories for ${goal}`);
}

// Imperial round-trips (within rounding).
assert.ok(Math.abs(lbToKg(176) - 79.83) < 0.1);
assert.ok(Math.abs(kgToLb(80) - 176.37) < 0.1);
assert.ok(Math.abs(ftInToCm(5, 11) - 180.34) < 0.1);
assert.deepEqual(cmToFtIn(180), { ft: 5, in: 11 });

console.log('nutrition-plan self-check passed');
