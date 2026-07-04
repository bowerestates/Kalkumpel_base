import { dateKey } from './date';
import { deleteAllMealPhotos, deleteMealPhoto } from './photo-storage';
import { recomputeStreakFromKeys } from './streak';
import { supabase } from './supabase';
import {
  DEFAULT_GOALS,
  DEFAULT_PROFILE,
  Entry,
  Goals,
  Profile,
  Streak,
  WeightEntry,
} from './types';

/**
 * The DB-swap boundary — now backed by Supabase (per-user, RLS-protected) instead
 * of AsyncStorage. UI and hooks keep calling these same functions; reads are cached
 * by TanStack Query (lib/queries.ts), so this layer is plain network I/O. Reminders
 * (lib/notifications.ts) and meal photos (lib/photos.ts) stay device-local.
 */

async function requireUid(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user?.id;
  if (!id) throw new Error('Not authenticated');
  return id;
}

type EntryRow = {
  id: string;
  date_key: string;
  ts: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  photo_uri: string | null;
  items: string[] | null;
};

function rowToEntry(r: EntryRow): Entry {
  return {
    id: r.id,
    timestamp: Number(r.ts),
    dateKey: r.date_key,
    name: r.name,
    calories: r.calories,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
    photoUri: r.photo_uri ?? undefined,
    items: r.items ?? undefined,
  };
}

export async function getEntries(): Promise<Entry[]> {
  const { data, error } = await supabase.from('entries').select('*').order('ts', { ascending: true });
  if (error) throw error;
  return (data as EntryRow[]).map(rowToEntry);
}

export async function getEntriesForDate(key: string): Promise<Entry[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('date_key', key)
    .order('ts', { ascending: true });
  if (error) throw error;
  return (data as EntryRow[]).map(rowToEntry);
}

export async function getEntry(id: string): Promise<Entry | undefined> {
  const { data, error } = await supabase.from('entries').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToEntry(data as EntryRow) : undefined;
}

/** Update an existing entry's editable fields (name + macros). Days logged are
 *  unchanged, so streak isn't affected. */
export async function updateEntry(
  id: string,
  patch: Pick<Entry, 'name' | 'calories' | 'protein' | 'carbs' | 'fat'>
): Promise<void> {
  const { error } = await supabase.from('entries').update(patch).eq('id', id);
  if (error) throw error;
}

export type NewEntry = Omit<Entry, 'id' | 'timestamp' | 'dateKey'>;

/** The new entry plus the streak on either side of the add, so callers can react
 *  to a streak increment without reaching past this boundary into storage. */
export type AddEntryResult = { entry: Entry; streakBefore: Streak; streakAfter: Streak };

/** All logged dateKeys for the current user (for streak recomputation). */
async function entryDateKeys(): Promise<string[]> {
  const { data, error } = await supabase.from('entries').select('date_key');
  if (error) throw error;
  return (data as { date_key: string }[]).map((r) => r.date_key);
}

/**
 * Add an entry. `forDateKey` back-dates it (the "log a meal I forgot" path);
 * omitted → today. Future dates are clamped to today *here*, at the DB boundary,
 * because `currentStreak` treats a future `lastLoggedDate` as broken — UI guards
 * are belt-and-suspenders, this is the authority. Streak is recomputed from the
 * full set of logged days both before and after (one path; deleting/back-dating
 * any day stays consistent).
 */
export async function addEntry(input: NewEntry, forDateKey?: string): Promise<AddEntryResult> {
  const today = dateKey();
  // YYYY-MM-DD sorts lexically, so string compare is a valid date compare.
  const requested = forDateKey ?? today;
  const key = requested > today ? today : requested;
  const backDated = key < today;

  const entry: Entry = {
    ...input,
    id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    // Noon of the back-dated day keeps intra-day ordering sane; today → now.
    timestamp: backDated ? new Date(key + 'T12:00:00').getTime() : Date.now(),
    dateKey: key,
  };

  const beforeKeys = await entryDateKeys();
  const streakBefore = recomputeStreakFromKeys(beforeKeys);

  const user_id = await requireUid();
  const { error } = await supabase.from('entries').insert({
    id: entry.id,
    user_id,
    date_key: entry.dateKey,
    ts: entry.timestamp,
    name: entry.name,
    calories: entry.calories,
    protein: entry.protein,
    carbs: entry.carbs,
    fat: entry.fat,
    photo_uri: entry.photoUri ?? null,
    items: entry.items ?? null,
  });
  if (error) throw error;

  const streakAfter = recomputeStreakFromKeys([...beforeKeys, entry.dateKey]);
  return { entry, streakBefore, streakAfter };
}

export async function removeEntry(id: string): Promise<void> {
  // Fetch first so we can clean up its Storage photo after the row is gone.
  const existing = await getEntry(id);
  const { error } = await supabase.from('entries').delete().eq('id', id);
  if (error) throw error;
  await deleteMealPhoto(existing?.photoUri);
}

/** Recompute the streak from the current user's logged days (no stored streak row). */
export async function getStreak(): Promise<Streak> {
  return recomputeStreakFromKeys(await entryDateKeys());
}

// --- Profile + goals (one row per user) ------------------------------------

type ProfileRow = {
  onboarded: boolean;
  sex: Profile['sex'];
  age: number;
  height_cm: number;
  weight_kg: number;
  activity: Profile['activity'];
  goal: Profile['goal'];
  units: Profile['units'];
  goal_calories: number;
  goal_protein: number;
  goal_carbs: number;
  goal_fat: number;
};

async function getProfileRow(): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'onboarded, sex, age, height_cm, weight_kg, activity, goal, units, goal_calories, goal_protein, goal_carbs, goal_fat'
    )
    .maybeSingle();
  if (error) throw error;
  return (data as ProfileRow) ?? null;
}

/**
 * Row-aware onboarded flag for the root gate. Returns the boolean when the profile
 * row exists, or `null` when it's not visible yet (no row) — distinct from a real
 * `onboarded=false`. Throws on a transport/RLS error. Lets onboarding-state retry
 * through the transient post-login window instead of collapsing null → not-onboarded.
 */
export async function getOnboardedFlag(): Promise<boolean | null> {
  const r = await getProfileRow();
  return r ? r.onboarded : null;
}

export async function getProfile(): Promise<Profile> {
  const r = await getProfileRow();
  if (!r) return DEFAULT_PROFILE;
  return {
    onboarded: r.onboarded,
    sex: r.sex,
    age: r.age,
    heightCm: Number(r.height_cm),
    weightKg: Number(r.weight_kg),
    activity: r.activity,
    goal: r.goal,
    units: r.units,
  };
}

export async function setProfile(profile: Profile): Promise<void> {
  const id = await requireUid();
  const { error } = await supabase.from('profiles').upsert({
    id,
    onboarded: profile.onboarded,
    sex: profile.sex,
    age: profile.age,
    height_cm: profile.heightCm,
    weight_kg: profile.weightKg,
    activity: profile.activity,
    goal: profile.goal,
    units: profile.units,
  });
  if (error) throw error;
}

export async function getGoals(): Promise<Goals> {
  const r = await getProfileRow();
  if (!r) return DEFAULT_GOALS;
  return { calories: r.goal_calories, protein: r.goal_protein, carbs: r.goal_carbs, fat: r.goal_fat };
}

export async function setGoals(goals: Goals): Promise<void> {
  const id = await requireUid();
  const { error } = await supabase.from('profiles').upsert({
    id,
    goal_calories: goals.calories,
    goal_protein: goals.protein,
    goal_carbs: goals.carbs,
    goal_fat: goals.fat,
  });
  if (error) throw error;
}

/** Wipe this user's logged data and restart onboarding (Settings → reset). The
 *  profiles row is kept (it's the auth linkage) but reset to defaults. */
export async function resetAllData(): Promise<void> {
  const id = await requireUid();
  await deleteAllMealPhotos(id); // Storage isn't in the DB cascade — clear it explicitly.
  const del1 = await supabase.from('entries').delete().eq('user_id', id);
  if (del1.error) throw del1.error;
  const del2 = await supabase.from('weights').delete().eq('user_id', id);
  if (del2.error) throw del2.error;
  const { error } = await supabase.from('profiles').upsert({
    id,
    onboarded: false,
    sex: DEFAULT_PROFILE.sex,
    age: DEFAULT_PROFILE.age,
    height_cm: DEFAULT_PROFILE.heightCm,
    weight_kg: DEFAULT_PROFILE.weightKg,
    activity: DEFAULT_PROFILE.activity,
    goal: DEFAULT_PROFILE.goal,
    units: DEFAULT_PROFILE.units,
    goal_calories: DEFAULT_GOALS.calories,
    goal_protein: DEFAULT_GOALS.protein,
    goal_carbs: DEFAULT_GOALS.carbs,
    goal_fat: DEFAULT_GOALS.fat,
  });
  if (error) throw error;
}

// --- Body weight -----------------------------------------------------------

type WeightRow = { id: string; date_key: string; ts: number; kg: number };

function rowToWeight(r: WeightRow): WeightEntry {
  return { id: r.id, timestamp: Number(r.ts), dateKey: r.date_key, kg: Number(r.kg) };
}

/** All logged weights, oldest first. */
export async function getWeights(): Promise<WeightEntry[]> {
  const { data, error } = await supabase
    .from('weights')
    .select('id, date_key, ts, kg')
    .order('ts', { ascending: true });
  if (error) throw error;
  return (data as WeightRow[]).map(rowToWeight);
}

/** Log today's weight (kg). One entry per day — re-logging replaces today's. */
export async function addWeight(kg: number): Promise<WeightEntry> {
  const key = dateKey();
  const entry: WeightEntry = {
    id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    timestamp: Date.now(),
    dateKey: key,
    kg,
  };
  const user_id = await requireUid();
  const { error } = await supabase.from('weights').upsert(
    { user_id, date_key: entry.dateKey, id: entry.id, ts: entry.timestamp, kg: entry.kg },
    { onConflict: 'user_id,date_key' }
  );
  if (error) throw error;
  return entry;
}

/** Most recently logged weight, or null if none. */
export async function latestWeight(): Promise<WeightEntry | null> {
  const all = await getWeights();
  return all.length ? all[all.length - 1] : null;
}

export type Totals = { calories: number; protein: number; carbs: number; fat: number };

export function sumTotals(entries: Entry[]): Totals {
  return entries.reduce<Totals>(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}
