import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';
import type { Entry, Goals, Profile, WeightEntry } from './types';

/**
 * One-time best-effort migration of pre-auth on-device data (the old AsyncStorage
 * keys) into the signed-in user's cloud rows. Runs once per user, only into a
 * fresh account (no cloud entries yet), then sets a flag so it never repeats.
 * Any failure is swallowed by the caller — the app works regardless.
 */
const FLAG = 'migratedTo';

export async function runMigrationIfNeeded(uid: string): Promise<void> {
  if ((await AsyncStorage.getItem(FLAG)) === uid) return;

  // Only seed a genuinely fresh account — never clobber existing cloud data. An
  // account is "fresh" only if it has never been onboarded AND has no entries AND
  // no weights (checking entries alone would overwrite a profile-only account).
  const [{ data: prof }, { count: entryCount }, { count: weightCount }] = await Promise.all([
    supabase.from('profiles').select('onboarded').maybeSingle(),
    supabase.from('entries').select('id', { count: 'exact', head: true }),
    supabase.from('weights').select('id', { count: 'exact', head: true }),
  ]);
  const fresh = !prof?.onboarded && !entryCount && !weightCount;
  if (!fresh) {
    await AsyncStorage.setItem(FLAG, uid);
    return;
  }

  const [entriesRaw, weightsRaw, profileRaw, goalsRaw] = await Promise.all([
    AsyncStorage.getItem('entries'),
    AsyncStorage.getItem('weights'),
    AsyncStorage.getItem('profile'),
    AsyncStorage.getItem('goals'),
  ]);

  const entries: Entry[] = entriesRaw ? JSON.parse(entriesRaw) : [];
  const weights: WeightEntry[] = weightsRaw ? JSON.parse(weightsRaw) : [];
  const profile: Profile | null = profileRaw ? JSON.parse(profileRaw) : null;
  const goals: Goals | null = goalsRaw ? JSON.parse(goalsRaw) : null;

  if (entries.length) {
    const { error } = await supabase.from('entries').insert(
      entries.map((e) => ({
        id: e.id,
        user_id: uid,
        date_key: e.dateKey,
        ts: e.timestamp,
        name: e.name,
        calories: e.calories,
        protein: e.protein,
        carbs: e.carbs,
        fat: e.fat,
        // Legacy local file:// URIs are meaningless in the cloud — drop them.
        photo_uri: e.photoUri && !e.photoUri.startsWith('file:') ? e.photoUri : null,
        items: e.items ?? null,
      }))
    );
    if (error) throw error;
  }

  if (weights.length) {
    const { error } = await supabase.from('weights').upsert(
      weights.map((w) => ({ user_id: uid, date_key: w.dateKey, id: w.id, ts: w.timestamp, kg: w.kg })),
      { onConflict: 'user_id,date_key' }
    );
    if (error) throw error;
  }

  if (profile || goals) {
    const { error } = await supabase.from('profiles').upsert({
      id: uid,
      ...(profile
        ? {
            onboarded: profile.onboarded,
            sex: profile.sex,
            age: profile.age,
            height_cm: profile.heightCm,
            weight_kg: profile.weightKg,
            activity: profile.activity,
            goal: profile.goal,
            units: profile.units,
          }
        : {}),
      ...(goals
        ? {
            goal_calories: goals.calories,
            goal_protein: goals.protein,
            goal_carbs: goals.carbs,
            goal_fat: goals.fat,
          }
        : {}),
    });
    if (error) throw error;
  }

  await AsyncStorage.setItem(FLAG, uid);
}
