import { Pressable, StyleSheet, Text, View } from 'react-native';

import { C, font } from '@/constants/theme';
import { dateKey } from '@/lib/date';

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * Horizontal Sun–Sat strip for the current week. Today is ringed; the selected
 * day is a filled chip. Future days are disabled. Days with logged meals get a dot.
 */
export function WeekStrip({
  selectedKey,
  onSelect,
  loggedKeys,
}: {
  selectedKey: string;
  onSelect: (key: string) => void;
  loggedKeys?: Set<string>;
}) {
  const today = new Date();
  const todayKey = dateKey(today);
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());

  return (
    <View style={styles.row}>
      {LETTERS.map((letter, i) => {
        const d = new Date(sunday);
        d.setDate(sunday.getDate() + i);
        const key = dateKey(d);
        const isFuture = key > todayKey;
        const isToday = key === todayKey;
        const isSelected = key === selectedKey;
        const logged = loggedKeys?.has(key) && !isSelected;
        return (
          <Pressable
            key={key}
            style={styles.col}
            disabled={isFuture}
            onPress={() => onSelect(key)}
            hitSlop={6}>
            <Text style={[styles.letter, isFuture && styles.faded]}>{letter}</Text>
            <View
              style={[
                styles.chip,
                isToday && !isSelected && styles.chipToday,
                isSelected && styles.chipSelected,
              ]}>
              <Text
                style={[
                  styles.num,
                  isSelected && styles.numSelected,
                  isFuture && styles.faded,
                ]}>
                {d.getDate()}
              </Text>
            </View>
            <View style={[styles.dot, logged && styles.dotOn]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { alignItems: 'center', gap: 6, flex: 1 },
  letter: { fontSize: 12, color: C.sub, fontFamily: font.semibold },
  chip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chipToday: { borderColor: C.ink },
  chipSelected: { backgroundColor: C.ink },
  num: { fontSize: 15, color: C.ink, fontFamily: font.semibold, fontVariant: ['tabular-nums'] },
  numSelected: { color: C.card },
  faded: { opacity: 0.3 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },
  dotOn: { backgroundColor: C.streak },
});
