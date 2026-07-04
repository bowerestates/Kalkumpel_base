export type Goals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type Entry = {
  id: string;
  timestamp: number;
  /** YYYY-MM-DD local date key — the grouping unit for days/streaks. */
  dateKey: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Persistent uri of the meal photo (copied out of the temp cache on save). */
  photoUri?: string;
  /** Optional breakdown of detected items, informational only. */
  items?: string[];
};

export type Streak = {
  current: number;
  longest: number;
  /** YYYY-MM-DD of the last day an entry was logged. */
  lastLoggedDate: string | null;
};

/** A single logged body-weight measurement (storage is always kg). */
export type WeightEntry = {
  id: string;
  timestamp: number;
  /** YYYY-MM-DD local date key — one logged weight per day (latest wins). */
  dateKey: string;
  kg: number;
};

/** A single user-defined daily reminder. */
export type Reminder = { id: string; label: string; hour: number; minute: number };

export type Prefs = {
  remindersEnabled: boolean;
  /** User-managed list: add/remove/rename/retime freely. */
  reminders: Reminder[];
  /** IDs returned by scheduleNotificationAsync, so we can cancel/reschedule. */
  scheduledNotificationIds: string[];
};

/** Legacy prefs shape (fixed breakfast/lunch/dinner) — only for migration in getPrefs. */
export type LegacyPrefs = {
  remindersEnabled?: boolean;
  mealTimes?: Record<string, { hour: number; minute: number }>;
  reminders?: Reminder[];
  scheduledNotificationIds?: string[];
};

export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'very' | 'extra';
export type Goal = 'lose' | 'maintain' | 'gain' | 'muscle';
export type Units = 'metric' | 'imperial';

/** Onboarding profile — the inputs that compute a recommended calorie/macro plan. */
export type Profile = {
  onboarded: boolean;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: Goal;
  /** Preferred input units for the stats screen (storage is always metric). */
  units: Units;
};

export const DEFAULT_GOALS: Goals = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fat: 65,
};

export const DEFAULT_PREFS: Prefs = {
  remindersEnabled: false,
  reminders: [
    { id: 'breakfast', label: 'Breakfast', hour: 8, minute: 0 },
    { id: 'lunch', label: 'Lunch', hour: 12, minute: 30 },
    { id: 'dinner', label: 'Dinner', hour: 19, minute: 0 },
  ],
  scheduledNotificationIds: [],
};

export const DEFAULT_PROFILE: Profile = {
  onboarded: false,
  sex: 'male',
  age: 30,
  heightCm: 175,
  weightKg: 75,
  activity: 'moderate',
  goal: 'maintain',
  units: 'metric',
};

export const DEFAULT_STREAK: Streak = {
  current: 0,
  longest: 0,
  lastLoggedDate: null,
};
