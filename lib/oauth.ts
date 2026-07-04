import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from './supabase';

// Lets the in-app browser dismiss itself when the OAuth redirect returns.
WebBrowser.maybeCompleteAuthSession();

/**
 * Turn an OAuth redirect URL into a session. Handles both the implicit (`#access_token`) and the
 * PKCE (`?code=`) returns; `flowType: 'implicit'` is pinned in supabase.ts (PKCE breaks in Expo Go —
 * no WebCrypto), so the `#access_token` branch is the live path and the `?code=` branch only guards a
 * future server-side flow change. No-op if neither is present.
 * `URLSearchParams` is polyfilled by react-native-url-polyfill/auto (imported in supabase.ts).
 */
export async function exchangeFromUrl(url: string): Promise<void> {
  // PKCE: ?code=...
  const qIndex = url.indexOf('?');
  const query = qIndex >= 0 ? url.slice(qIndex + 1).split('#')[0] : '';
  const code = new URLSearchParams(query).get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }
  // Implicit: #access_token=...&refresh_token=...
  const hIndex = url.indexOf('#');
  const frag = hIndex >= 0 ? url.slice(hIndex + 1) : '';
  const params = new URLSearchParams(frag);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
  }
}

/**
 * Google sign-in, Expo Go-compatible (implicit flow + system browser, no native Google SDK).
 * Web uses the standard redirect flow (detectSessionInUrl consumes the token at the root). Native
 * opens the consent page in the in-app browser; on iOS `openAuthSessionAsync` hands the redirect URL
 * straight back here, while on Android Expo Go the `exp://` redirect cold-reloads the app at the
 * `app/auth-callback` route, which reads the launch URL and finishes the exchange there. Both paths
 * funnel through `exchangeFromUrl`. NOTE: GoTrue rejects any redirect_to whose host is a numeric IP
 * (anti-open-redirect), so Expo Go must run with `--tunnel` (host becomes `*.exp.direct`) — a raw
 * LAN-IP `exp://` URL is silently dropped to site_url. See gotrue-blocks-ip-host-redirects memory.
 */
export async function signInWithGoogle(): Promise<void> {
  // Linking.createURL deep-links back into the running app with the right scheme. Native emits
  // exp://<host>:8081/--/auth-callback (Expo Go; host must be alphanumeric -> use --tunnel) or
  // calorietracker://auth-callback (dev/standalone build), matched by exp://** / calorietracker://**.
  // makeRedirectUri does NOT reliably produce this in Expo Go, so the flow ended at site_url.
  // Web is a single-output SPA: land on the root ('') so detectSessionInUrl consumes the #access_token
  // (a '/auth-callback' path on web has no route -> "Unmatched Route"). The native /--/auth-callback
  // cold-reload is handled by the app/auth-callback.tsx route.
  const redirectTo = Linking.createURL(process.env.EXPO_OS === 'web' ? '' : 'auth-callback');

  if (process.env.EXPO_OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) throw error;
    return; // browser redirect + detectSessionInUrl finishes it
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success') await exchangeFromUrl(result.url);
}
