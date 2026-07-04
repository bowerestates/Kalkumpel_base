import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { BounceIn, FadeOut } from 'react-native-reanimated';

import { Brand } from '@/constants/theme';

export type Celebration = { id: number; message: string; emoji: string };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A celebratory "ta-da" haptic — two impacts then a Success — distinct from the single
 * Success buzz the save action already fires, so a goal hit *feels* different. `signal`
 * lets the caller abort if the badge is dismissed mid-pattern.
 */
async function playCelebrationHaptic(signal: { cancelled: boolean }) {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  await wait(90);
  if (signal.cancelled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  await wait(90);
  if (signal.cancelled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/**
 * A celebratory badge that bounces in, fires a celebratory haptic, and auto-dismisses.
 * Driven by a FIFO queue in the parent: render the head `item`, and `onDone` shifts it
 * once the badge has had its moment so the next queued win plays. Renders nothing when
 * the queue is empty.
 */
export function CelebrationOverlay({
  item,
  onDone,
}: {
  item?: Celebration;
  onDone: () => void;
}) {
  useEffect(() => {
    if (!item) return;
    const signal = { cancelled: false };
    if (process.env.EXPO_OS !== 'web') playCelebrationHaptic(signal);
    const t = setTimeout(onDone, 1400);
    return () => {
      signal.cancelled = true;
      clearTimeout(t);
    };
    // Key on id, not message: two identical-message wins are distinct items, each
    // needs its own haptic + timer or the queue stalls on the duplicate.
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;

  return (
    <Animated.View
      key={item.id}
      pointerEvents="none"
      entering={BounceIn}
      exiting={FadeOut.duration(250)}
      style={styles.wrap}>
      <Text style={styles.emoji}>{item.emoji}</Text>
      <Text style={styles.message}>{item.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    // Anchored low so the badge never lands on top of the nutrition rings/readouts.
    bottom: '14%',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
    paddingHorizontal: 28,
    borderRadius: 24,
    borderCurve: 'continuous',
    backgroundColor: Brand.accent,
    boxShadow: '0 8px 24px rgba(255,107,53,0.45)',
  },
  emoji: { fontSize: 48 },
  message: { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' },
});
