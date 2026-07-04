import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { C, cardStyle, font } from '@/constants/theme';
import { useSignedPhoto } from '@/lib/photo-storage';
import { Entry } from '@/lib/types';

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Cal AI-style logged-meal card: photo, name + time, calories, and macro chips.
 * Tapping opens the entry in edit mode; the trailing button deletes it.
 */
export function MealCard({ entry, onDelete }: { entry: Entry; onDelete: (id: string) => void }) {
  const photo = useSignedPhoto(entry.photoUri);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo]); // a rotated signed URL gets a fresh try
  return (
    <View style={[cardStyle, styles.card]}>
      <Link href={{ pathname: '/review', params: { id: entry.id } }} asChild>
        <Pressable style={styles.tap}>
          {photo && !failed ? (
            <Image source={{ uri: photo }} style={styles.thumb} contentFit="cover" onError={() => setFailed(true)} />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]}>
              <IconSymbol name="fork.knife" size={22} color={C.faint} />
            </View>
          )}
          <View style={styles.main}>
            <Text style={styles.name} numberOfLines={1}>
              {entry.name}
            </Text>
            <Text style={styles.time}>{fmtTime(entry.timestamp)}</Text>
            <View style={styles.macroRow}>
              <IconSymbol name="flame.fill" size={13} color={C.calorie} />
              <Text style={styles.cals}>{entry.calories} cal</Text>
              <Macro value={entry.protein} color={C.protein} />
              <Macro value={entry.carbs} color={C.carbs} />
              <Macro value={entry.fat} color={C.fat} />
            </View>
          </View>
        </Pressable>
      </Link>
      <Pressable onPress={() => onDelete(entry.id)} hitSlop={10} style={styles.del}>
        <IconSymbol name="trash" size={16} color={C.faint} />
      </Pressable>
    </View>
  );
}

function Macro({ value, color }: { value: number; color: string }) {
  return (
    <View style={styles.macro}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.macroText}>{value}g</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', padding: 10, paddingRight: 8 },
  tap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 60, height: 60, borderRadius: 14, borderCurve: 'continuous', backgroundColor: C.hairline },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, gap: 2 },
  name: { fontSize: 16, color: C.ink, fontFamily: font.bold },
  time: { fontSize: 12, color: C.faint, fontFamily: font.medium },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  cals: { fontSize: 13, color: C.ink, fontFamily: font.semibold, fontVariant: ['tabular-nums'], marginRight: 2 },
  macro: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  macroText: { fontSize: 12, color: C.sub, fontFamily: font.medium, fontVariant: ['tabular-nums'] },
  del: { padding: 8, alignSelf: 'flex-start' },
});
