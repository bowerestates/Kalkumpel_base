import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/lib/auth-state';
import { useOnboarding } from '@/lib/onboarding-state';
import { exchangeFromUrl } from '@/lib/oauth';
import { C } from '@/constants/theme';

// OAuth deep-link landing route. On Android Expo Go the `exp://.../--/auth-callback#access_token=...`
// redirect cold-reloads the app straight to this route (it is NOT caught by openAuthSessionAsync),
// so we read the launch URL here and turn its token fragment into a session. Registered outside the
// auth guard in _layout.tsx because the user isn't signed in yet when this runs. Web never lands
// here (it redirects to '/' where detectSessionInUrl consumes the hash) — see lib/oauth.ts.
export default function AuthCallback() {
  const url = Linking.useURL();
  const { session, user } = useAuth();
  const { ready: onbReady, onboarded } = useOnboarding();

  useEffect(() => {
    if (url) exchangeFromUrl(url).catch(() => {}); // bad/expired link -> stay on spinner; gate falls back to auth
  }, [url]);

  // Once the session lands, route out of this URL. Wait for the profile to settle and route to
  // '/onboarding' for a brand-new account: a naive router.replace('/') targets (tabs), which is
  // gated out until onboarded, so it silently no-ops and the user is stranded on this spinner —
  // the exact stuck-after-Google-signup bug. Mirrors reset-password's nav effect.
  useEffect(() => {
    if (session && user && onbReady) router.replace(onboarded ? '/' : '/onboarding');
  }, [session, user, onbReady, onboarded]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
      <ActivityIndicator color={C.ink} />
    </View>
  );
}
