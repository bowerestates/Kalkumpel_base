import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppLogo } from '@/components/app-logo';
import { C } from '@/constants/theme';

/**
 * Full-screen branded loading (splash-matching background + logo). Used both as the
 * root-gate overlay while `!booted` and to cover the post-password-recovery window
 * so a gate transition (auth group tearing down) never flashes the login screen.
 */
export function BrandLoading() {
  return (
    <View style={styles.wrap}>
      <AppLogo />
      <ActivityIndicator color={C.ink} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
});
