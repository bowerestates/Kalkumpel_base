import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLogo } from '@/components/app-logo';
import { Celebration, CelebrationOverlay } from '@/components/celebration-overlay';
import { MealCard } from '@/components/meal-card';
import { CalorieCard, MacroCards } from '@/components/nutrition-rings';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { WeekStrip } from '@/components/week-strip';
import { C, cardStyle, font } from '@/constants/theme';
import { dateKey, shortLabel } from '@/lib/date';
import { removeEntry, sumTotals } from '@/lib/entries';
import { useEntries } from '@/lib/useEntries';

const MILESTONES = [3, 7, 14, 30, 50, 100];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const topPad = process.env.EXPO_OS === 'android' ? insets.top + 12 : 20;
  const { entries, todayEntries, totals, goals, streakCount, loading, reload } = useEntries();

  const today = dateKey();
  const [selectedKey, setSelectedKey] = useState(today);
  const isToday = selectedKey === today;
  const dayEntries = isToday ? todayEntries : entries.filter((e) => e.dateKey === selectedKey);
  const dayTotals = isToday ? totals : sumTotals(dayEntries);
  const loggedKeys = new Set(entries.map((e) => e.dateKey));

  // --- Goal + streak celebrations (today only) ----------------------------
  const [queue, setQueue] = useState<Celebration[]>([]);
  const [pulseKey, setPulseKey] = useState(0);

  const met = {
    calories: goals.calories > 0 && totals.calories >= goals.calories,
    protein: goals.protein > 0 && totals.protein >= goals.protein,
    carbs: goals.carbs > 0 && totals.carbs >= goals.carbs,
    fat: goals.fat > 0 && totals.fat >= goals.fat,
  };
  const perfect = met.calories && met.protein && met.carbs && met.fat;

  const prevMet = useRef(met);
  const prevPerfect = useRef(perfect);
  const prevStreak = useRef(streakCount);
  const initialized = useRef(false);
  const nextId = useRef(0);

  const streakScale = useSharedValue(1);
  const streakAnim = useAnimatedStyle(() => ({ transform: [{ scale: streakScale.value }] }));

  useEffect(() => {
    if (loading) return;
    if (!initialized.current) {
      prevMet.current = met;
      prevPerfect.current = perfect;
      prevStreak.current = streakCount;
      initialized.current = true;
      return;
    }

    const mk = (emoji: string, message: string): Celebration => ({ id: nextId.current++, emoji, message });
    const caloriesCrossed = met.calories && !prevMet.current.calories;

    const fresh: Celebration[] = [];
    if (perfect && !prevPerfect.current) {
      fresh.push(mk('🎉', 'Perfect day — all goals hit!'));
    } else {
      if (caloriesCrossed) fresh.push(mk('🔥', 'Calorie goal reached!'));
      if (met.protein && !prevMet.current.protein) fresh.push(mk('💪', 'Protein goal hit!'));
    }

    if (streakCount > prevStreak.current) {
      streakScale.value = withSequence(withSpring(1.3), withSpring(1));
      if (MILESTONES.includes(streakCount)) fresh.push(mk('🔥', `${streakCount}-day streak!`));
    }

    if (fresh.length) setQueue((q) => [...q, ...fresh]);
    if (caloriesCrossed) setPulseKey((k) => k + 1);

    prevMet.current = met;
    prevPerfect.current = perfect;
    prevStreak.current = streakCount;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, met.calories, met.protein, met.carbs, met.fat, streakCount]);

  async function handleDelete(id: string) {
    await removeEntry(id);
    reload();
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        style={{ backgroundColor: C.bg }}
        contentContainerStyle={[styles.content, { paddingTop: topPad }]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <AppLogo />
          <Animated.View style={[styles.streak, { opacity: streakCount === 0 ? 0.5 : 1 }, streakAnim]}>
            <IconSymbol name="flame.fill" size={16} color={C.streak} />
            <Text style={styles.streakText}>{streakCount}</Text>
          </Animated.View>
        </View>

        <WeekStrip selectedKey={selectedKey} onSelect={setSelectedKey} loggedKeys={loggedKeys} />

        <CalorieCard totals={dayTotals} goals={goals} pulseKey={isToday ? pulseKey : 0} />
        <MacroCards totals={dayTotals} goals={goals} />

        <Text style={styles.section}>{isToday ? 'Recently uploaded' : shortLabel(selectedKey)}</Text>

        {dayEntries.length ? (
          dayEntries
            .slice()
            .sort((a, b) => b.timestamp - a.timestamp)
            .map((e) => <MealCard key={e.id} entry={e} onDelete={handleDelete} />)
        ) : (
          <View style={[cardStyle, styles.empty]}>
            <IconSymbol name="fork.knife" size={26} color={C.faint} />
            <Text style={styles.emptyText}>No meals logged{isToday ? ' yet' : ' this day'}.</Text>
            <Text style={styles.emptySub}>Tap the + button to snap a meal.</Text>
          </View>
        )}
      </ScrollView>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: C.bg }}
      />
      <CelebrationOverlay item={queue[0]} onDone={() => setQueue((q) => q.slice(1))} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 18, paddingBottom: 140 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: C.card,
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  streakText: { fontSize: 15, color: C.ink, fontFamily: font.extrabold, fontVariant: ['tabular-nums'] },
  section: { fontSize: 18, color: C.ink, fontFamily: font.bold, marginTop: 2 },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 32 },
  emptyText: { fontSize: 15, color: C.sub, fontFamily: font.semibold },
  emptySub: { fontSize: 13, color: C.faint, fontFamily: font.medium },
});
