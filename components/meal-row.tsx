import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useSignedPhoto } from '@/lib/photo-storage';
import { Entry } from '@/lib/types';

/**
 * A single logged-meal row: photo/placeholder, name + macros, calories, and a
 * delete button. Tapping the row opens the entry in edit mode (`/review?id=`).
 * Shared by the Today screen and the per-day history view.
 */
export function MealRow({
  entry,
  text,
  sub,
  track,
  onDelete,
}: {
  entry: Entry;
  /** Primary text color. */
  text: string;
  /** Muted/secondary color (icons, macros). */
  sub: string;
  /** Track/placeholder background. */
  track: string;
  onDelete: (id: string) => void;
}) {
  const photo = useSignedPhoto(entry.photoUri);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo]); // a rotated signed URL gets a fresh try
  return (
    <View style={[styles.row, { borderColor: track }]}>
      <Link href={{ pathname: '/review', params: { id: entry.id } }} asChild>
        <Pressable style={styles.rowTap}>
          {photo && !failed ? (
            <Image
              source={{ uri: photo }}
              style={[styles.thumb, { backgroundColor: track }]}
              contentFit="cover"
              onError={() => setFailed(true)}
            />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: track }]}>
              <IconSymbol name="camera.fill" size={18} color={sub} />
            </View>
          )}
          <View style={styles.rowMain}>
            <Text style={[styles.rowName, { color: text }]} numberOfLines={2}>
              {entry.name}
            </Text>
            <Text style={[styles.rowMacros, { color: sub }]}>
              {entry.protein}p · {entry.carbs}c · {entry.fat}f
            </Text>
          </View>
          <Text style={[styles.rowCals, { color: text }]}>{entry.calories}</Text>
        </Pressable>
      </Link>
      <Pressable onPress={() => onDelete(entry.id)} hitSlop={10} style={styles.del}>
        <IconSymbol name="trash" size={18} color={sub} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, borderCurve: 'continuous', padding: 12 },
  rowTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 48, height: 48, borderRadius: 10, borderCurve: 'continuous' },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  rowMain: { flex: 1, gap: 2 },
  rowName: { fontSize: 16, fontWeight: '600' },
  rowMacros: { fontSize: 13, fontVariant: ['tabular-nums'] },
  rowCals: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  del: { padding: 4 },
});
