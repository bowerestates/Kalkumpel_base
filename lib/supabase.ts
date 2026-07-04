import 'react-native-url-polyfill/auto'; // MUST be first — supabase-js needs URL/URLSearchParams on RN.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js';
import * as aesjs from 'aes-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — set them in .env (see .env.example).'
  );
}

const isWeb = process.env.EXPO_OS === 'web';

/**
 * Encrypted session storage (Supabase's documented LargeSecureStore pattern).
 * The auth session holds the refresh token, so it must NOT live in plain
 * AsyncStorage. We keep a per-record AES key in expo-secure-store (Keychain /
 * Keystore) and the ciphertext in AsyncStorage — which also sidesteps SecureStore's
 * ~2KB Android value limit that a full session would blow past. Web has no
 * SecureStore, so the client falls back to AsyncStorage (localStorage) there.
 */
class LargeSecureStore {
  private async encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = Crypto.getRandomBytes(256 / 8);
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async decrypt(key: string, value: string): Promise<string | null> {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(encryptionKeyHex), new aesjs.Counter(1));
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    return this.decrypt(key, encrypted);
  }

  async setItem(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, await this.encrypt(key, value));
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }
}

const auth: SupabaseClientOptions<'public'>['auth'] = {
  storage: isWeb ? AsyncStorage : new LargeSecureStore(),
  autoRefreshToken: true,
  persistSession: true,
  // Native handles the OAuth/reset redirect manually; only web parses tokens from the URL.
  detectSessionInUrl: isWeb,
  // Implicit flow (matches the working habit-tracker app). PKCE breaks Google OAuth in Expo Go:
  // no WebCrypto -> code_challenge degrades to `plain`, GoTrue loses redirect_to from flow_state
  // and falls back to site_url (localhost:8081). Implicit carries redirect_to in the OAuth state.
  flowType: 'implicit',
};

export const supabase = createClient(url, anon, { auth });

// Keep tokens fresh only while the app is foregrounded (Supabase's recommended wiring).
if (!isWeb) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
