import AsyncStorage from '@react-native-async-storage/async-storage';

/** AsyncStorage keys. All app data lives behind these. */
export const KEYS = {
  goals: 'goals',
  entries: 'entries',
  streak: 'streak',
  prefs: 'prefs',
  profile: 'profile',
  weights: 'weights',
} as const;

/** Read + JSON-parse a key, returning `fallback` if missing or corrupt. */
export async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** JSON-stringify + write a key. */
export async function setJSON<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

/** Wipe all app data (Settings → reset). */
export async function clearAll(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}
