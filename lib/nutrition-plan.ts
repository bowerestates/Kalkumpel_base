import { Activity, Goal, Goals, Profile, Sex } from './types';

/**
 * Evidence-based recommended calorie + macro plan from a user's stats.
 * Sources: Mifflin-St Jeor BMR (Am J Clin Nutr 1990; ADA-endorsed, Frankenfield
 * 2005); FAO/WHO/UNU 2004 activity multipliers; ISSN 2017 protein position stand;
 * IOM AMDR (2002/2005). Storage is always metric; convert imperial input first.
 */

const PAL: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};

const GOAL_DELTA: Record<Goal, number> = {
  lose: -500, // ~0.5 kg/week
  maintain: 0,
  gain: 400, // lean-ish surplus
  muscle: 250, // lean bulk (Iraki 2019)
};

const PROTEIN_G_PER_KG: Record<Goal, number> = {
  lose: 2.0, // preserve lean mass in a deficit
  maintain: 1.6,
  gain: 1.6,
  muscle: 2.0,
};

const MIN_PROTEIN_G_PER_KG = 0.8; // RDA floor, only used by the carb guard
const FAT_FRACTION = 0.25; // target % of calories from fat
const FAT_FRACTION_MIN = 0.2; // AMDR floor for hormonal health
const KCAL = { protein: 4, carb: 4, fat: 9 } as const; // Atwater

/** ADA/NHS minimum daily intake without medical supervision. */
export function calorieFloor(sex: Sex): number {
  return sex === 'male' ? 1500 : 1200;
}

export function bmrMifflin(p: {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
}): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return base + (p.sex === 'male' ? 5 : -161);
}

export type Plan = Goals & {
  /** Calorie target was clamped up to the safe floor. */
  floored: boolean;
  /** Protein/fat had to be trimmed to fit the calorie budget. */
  compromised: boolean;
};

export function computePlan(profile: Profile): Plan {
  // Fall back to sensible defaults if a stored profile has a stale/corrupt enum
  // (e.g. after a schema change), so we never produce NaN goals.
  const tdee = bmrMifflin(profile) * (PAL[profile.activity] ?? PAL.moderate);
  const floor = calorieFloor(profile.sex);
  const targetRaw = tdee + (GOAL_DELTA[profile.goal] ?? 0);
  const calories = Math.max(targetRaw, floor);
  const floored = targetRaw < floor;

  // Protein-first, fat at 25%, carbs fill the remainder.
  let proteinG = profile.weightKg * (PROTEIN_G_PER_KG[profile.goal] ?? PROTEIN_G_PER_KG.maintain);
  let fatG = (calories * FAT_FRACTION) / KCAL.fat;
  let compromised = false;

  // Guard: if protein + fat already exceed the budget (carbs would go negative),
  // trim deterministically — fat to its 20% floor first, then protein toward RDA.
  const overBudget = () => proteinG * KCAL.protein + fatG * KCAL.fat > calories;
  if (overBudget()) {
    compromised = true;
    fatG = (calories * FAT_FRACTION_MIN) / KCAL.fat;
  }
  if (overBudget()) {
    const minProteinG = profile.weightKg * MIN_PROTEIN_G_PER_KG;
    const budgetForProteinG = (calories - fatG * KCAL.fat) / KCAL.protein;
    proteinG = Math.max(minProteinG, Math.min(proteinG, budgetForProteinG));
  }

  const carbG = Math.max((calories - proteinG * KCAL.protein - fatG * KCAL.fat) / KCAL.carb, 0);

  return {
    calories: Math.round(calories),
    protein: Math.round(proteinG),
    carbs: Math.round(carbG),
    fat: Math.round(fatG),
    floored,
    compromised,
  };
}

// --- imperial <-> metric helpers (storage is always metric) ---------------
export const lbToKg = (lb: number) => lb * 0.45359237;
export const kgToLb = (kg: number) => kg / 0.45359237;
export const inToCm = (inch: number) => inch * 2.54;
export const cmToIn = (cm: number) => cm / 2.54;
export const ftInToCm = (ft: number, inch: number) => inToCm(ft * 12 + inch);
export function cmToFtIn(cm: number): { ft: number; in: number } {
  const totalIn = Math.round(cmToIn(cm));
  const ft = Math.floor(totalIn / 12);
  return { ft, in: totalIn - ft * 12 };
}
