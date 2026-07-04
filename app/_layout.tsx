import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import 'react-native-reanimated';

import { BrandLoading } from '@/components/brand-loading';
import { AuthProvider, useAuth } from '@/lib/auth-state';
import { OnboardingProvider, useOnboarding } from '@/lib/onboarding-state';
import { asyncStoragePersister, queryClient } from '@/lib/query';

// Hold the splash until we know whether to show onboarding, so the tabs never flash.
SplashScreen.preventAutoHideAsync();

// Local notifications work in Expo Go; only remote push was removed (SDK 53+), so
// importing expo-notifications logs a benign push-registration warning/error. It's
// cosmetic (gone in a dev build), but it forwards to the Metro terminal, which
// LogBox can't hide — so filter those specific messages from the console in dev.
LogBox.ignoreLogs(['expo-notifications', 'Android Push notifications']);

if (__DEV__) {
  const SILENCED = [
    'expo-notifications',
    'Android Push notifications',
    'not fully supported in Expo Go',
  ];
  const matches = (args: unknown[]) =>
    typeof args[0] === 'string' && SILENCED.some((s) => (args[0] as string).includes(s));
  const origWarn = console.warn;
  const origError = console.error;
  console.warn = (...args: unknown[]) => {
    if (!matches(args)) origWarn(...args);
  };
  console.error = (...args: unknown[]) => {
    if (!matches(args)) origError(...args);
  };
}

export const unstable_settings = {
  anchor: '(tabs)',
};

// Content screens stay upright portrait; only the camera rotates. RNS applies the
// per-screen `orientation` trait and reasserts it on every transition, so leaving
// the camera snaps back to portrait. Camera uses 'all' (full sensor) — the only
// mode Samsung One UI honors for the 180°/landscape flip.
function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { ready: authReady, user } = useAuth();
  const { ready: onbReady, onboarded } = useOnboarding();
  const booted = authReady && onbReady && fontsLoaded;
  const authed = !!user;

  useEffect(() => {
    if (booted) SplashScreen.hideAsync();
  }, [booted]);

  // Three-state gate: not authed → auth; authed but not onboarded → onboarding
  // (the fallback when the app routes are gated out); authed + onboarded → app.
  // `onboarding` is nested under `authed` so Settings → Recalculate still reaches
  // it while onboarded. `reset-password` is always registered as a deep-link target.
  //
  // The navigator stays MOUNTED at all times; while `!booted` a branded loading
  // overlay covers it. Do NOT early-return a non-<Stack> here: that unmounts the
  // navigator on the login true→false→true `booted` flip, and on the remount
  // expo-router briefly shows the first-declared authed screen (`onboarding`) before
  // settling on the anchor `(tabs)` — the ~1s onboarding flash. Overlaying avoids the
  // remount; the native splash still covers cold-start frames (hideAsync fires only
  // once booted). When the overlay lifts, `onbReady` and `onboarded` have committed
  // together, so the revealed screen is already the correct one.
  return (
    <>
      <Stack screenOptions={{ orientation: 'portrait_up' }}>
        <Stack.Protected guard={!authed}>
          <Stack.Screen name="auth" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={authed}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Protected guard={onboarded}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="camera" options={{ headerShown: false, orientation: 'all' }} />
            <Stack.Screen name="review" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="day" options={{ presentation: 'modal' }} />
            <Stack.Screen name="change-password" options={{ presentation: 'modal', headerShown: false }} />
          </Stack.Protected>
        </Stack.Protected>
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
      </Stack>
      {!booted ? <BrandLoading /> : null}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  return (
    <ThemeProvider value={DefaultTheme}>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: asyncStoragePersister }}>
        <AuthProvider>
          <OnboardingProvider>
            <RootNavigator fontsLoaded={fontsLoaded} />
          </OnboardingProvider>
        </AuthProvider>
      </PersistQueryClientProvider>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
