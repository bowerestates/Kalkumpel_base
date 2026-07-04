import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme } from 'react-native';

import { MealRow } from '@/components/meal-row';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Brand, Colors } from '@/constants/theme';
import { dateKey } from '@/lib/date';
import { getEntriesForDate, removeEntry, sumTotals } from '@/lib/entries';
import { Entry } from '@/lib/types';

export default function DayScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const key = date ?? dateKey();
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const track = scheme === 'dark' ? '#2A2D2E' : '#EFEFEF';

  const [entries, setEntries] = useState<Entry[]>([]);
  const load = useCallback(() => {
    getEntriesForDate(key).then(setEntries);
  }, [key]);
  useFocusEffect(load);

  const totals = sumTotals(entries);
  const title = new Date(key + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const isFuture = key > dateKey();

  async function handleDelete(id: string) {
    await removeEntry(id);
    load();
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      <ScrollView
        style={{ backgroundColor: c.background }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic">
        <Text style={[styles.summary, { color: c.text }]} selectable>
          {Math.round(totals.calories)} kcal · {entries.length} {entries.length === 1 ? 'meal' : 'meals'}
        </Text>

        {entries.map((e) => (
          <MealRow key={e.id} entry={e} text={c.text} sub={c.icon} track={track} onDelete={handleDelete} />
        ))}

        {entries.length === 0 ? (
          <Text style={[styles.empty, { color: c.icon }]}>Nothing logged this day.</Text>
        ) : null}

        {!isFuture ? (
          <Pressable
            style={styles.add}
            onPress={() => router.push({ pathname: '/review', params: { date: key } })}>
            <IconSymbol name="plus.circle.fill" size={20} color="#fff" />
            <Text style={styles.addText}>Add a meal to this day</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12, paddingBottom: 48 },
  summary: { fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  empty: { fontSize: 15, paddingVertical: 8 },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Brand.accent,
    paddingVertical: 16,
    borderRadius: 16,
    borderCurve: 'continuous',
    marginTop: 4,
  },
  addText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
