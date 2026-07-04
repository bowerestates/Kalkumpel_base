import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { ProgressRing } from '@/components/ring-stat';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { C, cardStyle, font } from '@/constants/theme';
import { Totals } from '@/lib/entries';
import { Goals } from '@/lib/types';

/** Big "Calories eaten" card: eaten / goal on the left, progress ring on the right. */
export function CalorieCard({
  totals,
  goals,
  pulseKey = 0,
}: {
  totals: Totals;
  goals: Goals;
  /** Bump to pop the ring when the calorie goal is hit. */
  pulseKey?: number;
}) {
  const eaten = Math.round(totals.calories);
  const remaining = Math.max(goals.calories - eaten, 0);
  const progress = goals.calories ? totals.calories / goals.calories : 0;

  const scale = useSharedValue(1);
  useEffect(() => {
    if (pulseKey > 0) scale.value = withSequence(withSpring(1.12), withSpring(1));
  }, [pulseKey, scale]);
  const ringAnim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={[cardStyle, styles.calCard]}>
      <View style={styles.calLeft}>
        <Text style={styles.calNumber} numberOfLines={1}>
          {eaten}
          <Text style={styles.calGoal}> / {goals.calories}</Text>
        </Text>
        <Text style={styles.calLabel}>Calories eaten</Text>
        <Text style={styles.calRemaining}>{remaining} kcal left</Text>
      </View>
      <Animated.View style={ringAnim}>
        <ProgressRing size={84} stroke={10} progress={progress} color={C.calorie}>
          <IconSymbol name="flame.fill" size={28} color={C.calorie} />
        </ProgressRing>
      </Animated.View>
    </View>
  );
}

function MacroCard({
  label,
  value,
  goal,
  color,
}: {
  label: string;
  value: number;
  goal: number;
  color: string;
}) {
  return (
    <View style={[cardStyle, styles.macroCard]}>
      <ProgressRing size={56} stroke={7} progress={goal ? value / goal : 0} color={color}>
        <View style={[styles.macroDot, { backgroundColor: color }]} />
      </ProgressRing>
      <Text style={styles.macroValue} numberOfLines={1}>
        {Math.round(value)}
        <Text style={styles.macroUnit}>g</Text>
      </Text>
      <Text style={styles.macroLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Row of Protein / Carbs / Fat cards, each with a small progress ring. */
export function MacroCards({ totals, goals }: { totals: Totals; goals: Goals }) {
  return (
    <View style={styles.macros}>
      <MacroCard label="Protein" value={totals.protein} goal={goals.protein} color={C.protein} />
      <MacroCard label="Carbs" value={totals.carbs} goal={goals.carbs} color={C.carbs} />
      <MacroCard label="Fat" value={totals.fat} goal={goals.fat} color={C.fat} />
    </View>
  );
}

const styles = StyleSheet.create({
  calCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  calLeft: { flex: 1, gap: 2 },
  calNumber: { fontSize: 38, lineHeight: 42, color: C.ink, fontFamily: font.extrabold, fontVariant: ['tabular-nums'] },
  calGoal: { fontSize: 20, color: C.faint, fontFamily: font.semibold },
  calLabel: { fontSize: 14, color: C.sub, fontFamily: font.medium },
  calRemaining: { fontSize: 13, color: C.faint, fontFamily: font.medium, fontVariant: ['tabular-nums'], marginTop: 2 },
  macros: { flexDirection: 'row', gap: 12 },
  macroCard: { flex: 1, alignItems: 'center', paddingVertical: 16, gap: 8 },
  macroDot: { width: 12, height: 12, borderRadius: 6 },
  macroValue: { fontSize: 18, lineHeight: 20, color: C.ink, fontFamily: font.bold, fontVariant: ['tabular-nums'] },
  macroUnit: { fontSize: 13, color: C.faint, fontFamily: font.semibold },
  macroLabel: { fontSize: 12, color: C.sub, fontFamily: font.medium },
});
