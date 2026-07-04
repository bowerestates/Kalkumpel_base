import { Stack } from 'expo-router';

import { C } from '@/constants/theme';

export const unstable_settings = { initialRouteName: 'login' };

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="confirm-email" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
