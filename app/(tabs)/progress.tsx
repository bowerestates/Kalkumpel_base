import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { WeightChart } from '@/components/weight-chart';
import { C, cardStyle, font } from '@/constants/theme';
import { addWeight, getProfile, getWeights } from '@/lib/entries';
import { Profile, WeightEntry } from '@/lib/types';
import { useEntries } from '@/lib/useEntries';

const RANGES = [
  { key: '90D', days: 90 },
  { key: '6M', days: 182 },
  { key: '1Y', days: 365 },
  { key: 'ALL', days: Infinity },
] as const;

const DAY = 86_400_000;

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const topPad = process.env.EXPO_OS === 'android' ? insets.top + 12 : 20;
  const { entries, streak, streakCount } = useEntries();

  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rangeIdx, setRangeIdx] = useState(1); // default 6M
  const [logOpen, setLogOpen] = useState(false);
  const [logInput, setLogInput] = useState('');

  const loadWeights = useCallback(async () => {
    setWeights(await getWeights());
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadWeights();
      getProfile().then(setProfile);
    }, [loadWeights])
  );

  const imperial = profile?.units === 'imperial';
  const unit = imperial ? 'lbs' : 'kg';
  const toDisplay = (kg: number) => (imperial ? kg * 2.20462 : kg);
  const toKg = (v: number) => (imperial ? v / 2.20462 : v);

  const now = Date.now();
  const range = RANGES[rangeIdx];
  const cutoff = range.days === Infinity ? 0 : now - range.days * DAY;
  const rangedWeights = weights.filter((w) => w.timestamp >= cutoff);
  const chartWeights = rangedWeights.map((w) => ({ ...w, kg: toDisplay(w.kg) }));
  // Time domain the chart spreads points across. "ALL" starts at the first point;
  // fixed ranges start at the cutoff so the same recent points re-spread per range.
  const domainStart = range.days === Infinity ? (rangedWeights[0]?.timestamp ?? now - 30 * DAY) : cutoff;

  const latest = weights.length ? weights[weights.length - 1] : null;
  const currentKg = latest?.kg ?? profile?.weightKg ?? null;

  // Daily average calories over the selected range.
  const inRange = entries.filter((e) => e.timestamp >= cutoff);
  const byDay = new Map<string, number>();
  inRange.forEach((e) => byDay.set(e.dateKey, (byDay.get(e.dateKey) ?? 0) + e.calories));
  const dayTotals = [...byDay.values()];
  const avgCalories = dayTotals.length
    ? Math.round(dayTotals.reduce((a, b) => a + b, 0) / dayTotals.length)
    : 0;

  function saveWeight() {
    const v = parseFloat(logInput.replace(/[^0-9.]/g, ''));
    const kg = toKg(v);
    // kg 1..1000 matches the weights CHECK constraint; out-of-range just dismisses.
    if (!Number.isFinite(v) || v <= 0 || kg < 1 || kg > 1000) {
      setLogOpen(false);
      return;
    }
    addWeight(kg).then(() => {
      setLogInput('');
      setLogOpen(false);
      loadWeights();
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        style={{ backgroundColor: C.bg }}
        contentContainerStyle={[styles.content, { paddingTop: topPad }]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Progress</Text>

        <View style={styles.topRow}>
          <View style={[cardStyle, styles.weightCard]}>
            <Text style={styles.cardLabel}>Your weight</Text>
            <Text style={styles.weightValue} numberOfLines={1}>
              {currentKg != null ? toDisplay(currentKg).toFixed(1) : '—'}
              <Text style={styles.weightUnit}> {unit}</Text>
            </Text>
            <Pressable style={styles.logBtn} onPress={() => setLogOpen(true)}>
              <IconSymbol name="plus" size={15} color={C.card} />
              <Text style={styles.logBtnText}>Log weight</Text>
            </Pressable>
          </View>

          <View style={[cardStyle, styles.streakCard]}>
            <IconSymbol name="flame.fill" size={26} color="#fff" />
            <Text style={styles.streakNum}>{streakCount}</Text>
            <Text style={styles.streakLabel}>day streak</Text>
            <Text style={styles.streakBest}>Best {streak.longest}</Text>
          </View>
        </View>

        <View style={[cardStyle, styles.chartCard]}>
          <Text style={styles.cardLabel}>Weight progress</Text>
          {rangedWeights.length ? (
            <WeightChart weights={chartWeights} domainStart={domainStart} domainEnd={now} />
          ) : (
            <View style={styles.chartEmpty}>
              <IconSymbol name="scalemass.fill" size={26} color={C.faint} />
              <Text style={styles.emptyText}>No weight logged in this range.</Text>
              <Text style={styles.emptySub}>Tap “Log weight” to start your chart.</Text>
            </View>
          )}
          <View style={styles.ranges}>
            {RANGES.map((r, i) => (
              <Pressable
                key={r.key}
                style={[styles.rangeBtn, i === rangeIdx && styles.rangeBtnActive]}
                onPress={() => setRangeIdx(i)}>
                <Text style={[styles.rangeText, i === rangeIdx && styles.rangeTextActive]}>{r.key}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[cardStyle, styles.avgCard]}>
          <Text style={styles.cardLabel}>Daily average calories</Text>
          <Text style={styles.avgValue}>
            {avgCalories}
            <Text style={styles.avgUnit}> kcal</Text>
          </Text>
          <Text style={styles.avgSub}>
            {dayTotals.length
              ? `Across ${dayTotals.length} logged ${dayTotals.length === 1 ? 'day' : 'days'}`
              : 'No meals logged in this range'}
          </Text>
        </View>
      </ScrollView>

      <Modal visible={logOpen} transparent animationType="fade" onRequestClose={() => setLogOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setLogOpen(false)}>
          <Pressable style={[cardStyle, styles.logCard]} onPress={() => {}}>
            <Text style={styles.logTitle}>Log weight</Text>
            <View style={styles.logInputWrap}>
              <TextInput
                style={styles.logInputText}
                value={logInput}
                onChangeText={setLogInput}
                keyboardType="decimal-pad"
                placeholder="0.0"
                placeholderTextColor={C.faint}
                autoFocus
              />
              <Text style={styles.logUnit}>{unit}</Text>
            </View>
            <Pressable style={styles.logSave} onPress={saveWeight}>
              <Text style={styles.logSaveText}>Save</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: C.bg }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 140 },
  title: { fontSize: 32, color: C.ink, fontFamily: font.extrabold, letterSpacing: -0.5 },
  topRow: { flexDirection: 'row', gap: 12 },
  weightCard: { flex: 1, padding: 16, gap: 6, justifyContent: 'space-between' },
  cardLabel: { fontSize: 13, color: C.sub, fontFamily: font.semibold },
  weightValue: { fontSize: 28, color: C.ink, fontFamily: font.extrabold, fontVariant: ['tabular-nums'] },
  weightUnit: { fontSize: 15, color: C.faint, fontFamily: font.semibold },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: C.ink,
    paddingVertical: 10,
    borderRadius: 12,
    borderCurve: 'continuous',
    marginTop: 4,
  },
  logBtnText: { color: C.card, fontSize: 14, fontFamily: font.semibold },
  streakCard: { width: 130, backgroundColor: C.streak, alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 2 },
  streakNum: { fontSize: 34, color: '#fff', fontFamily: font.extrabold, fontVariant: ['tabular-nums'] },
  streakLabel: { fontSize: 13, color: '#fff', fontFamily: font.semibold, opacity: 0.95 },
  streakBest: { fontSize: 12, color: '#fff', fontFamily: font.medium, opacity: 0.85, marginTop: 2 },
  chartCard: { padding: 16, gap: 8 },
  chartEmpty: { height: 170, alignItems: 'center', justifyContent: 'center', gap: 6 },
  emptyText: { fontSize: 14, color: C.sub, fontFamily: font.semibold },
  emptySub: { fontSize: 12, color: C.faint, fontFamily: font.medium },
  ranges: { flexDirection: 'row', gap: 8, marginTop: 4 },
  rangeBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, borderCurve: 'continuous', backgroundColor: C.bg, alignItems: 'center' },
  rangeBtnActive: { backgroundColor: C.ink },
  rangeText: { fontSize: 13, color: C.sub, fontFamily: font.semibold },
  rangeTextActive: { color: C.card },
  avgCard: { padding: 16, gap: 4 },
  avgValue: { fontSize: 28, color: C.ink, fontFamily: font.extrabold, fontVariant: ['tabular-nums'] },
  avgUnit: { fontSize: 15, color: C.faint, fontFamily: font.semibold },
  avgSub: { fontSize: 13, color: C.sub, fontFamily: font.medium },
  backdrop: { flex: 1, backgroundColor: '#0007', justifyContent: 'center', alignItems: 'center', padding: 28 },
  logCard: { width: '100%', padding: 20, gap: 14 },
  logTitle: { fontSize: 18, color: C.ink, fontFamily: font.bold },
  logInputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.hairline, borderRadius: 14, borderCurve: 'continuous', paddingHorizontal: 16 },
  logInputText: { flex: 1, paddingVertical: 14, fontSize: 22, color: C.ink, fontFamily: font.bold, fontVariant: ['tabular-nums'] },
  logUnit: { fontSize: 15, color: C.faint, fontFamily: font.semibold },
  logSave: { backgroundColor: C.ink, paddingVertical: 14, borderRadius: 14, borderCurve: 'continuous', alignItems: 'center' },
  logSaveText: { color: C.card, fontSize: 16, fontFamily: font.bold },
});
