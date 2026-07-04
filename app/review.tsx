import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProgressRing } from '@/components/ring-stat';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { C, cardStyle, font } from '@/constants/theme';
import { useKeyboardAwareScroll } from '@/hooks/use-keyboard-aware-scroll';
import { addEntry, getEntry, updateEntry } from '@/lib/entries';
import { congratulateStreak } from '@/lib/notifications';
import { analyzeMeal } from '@/lib/nutrition-api';
import { deleteMealPhoto, uploadMealPhoto, useSignedPhoto } from '@/lib/photo-storage';

function numFromText(t: string): number {
  const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

const MACROS = [
  { key: 'protein', label: 'Protein', color: C.protein },
  { key: 'carbs', label: 'Carbs', color: C.carbs },
  { key: 'fat', label: 'Fat', color: C.fat },
] as const;

export default function ReviewScreen() {
  const { uri, id, date } = useLocalSearchParams<{ uri?: string; id?: string; date?: string }>();
  const isEdit = !!id;
  const isBackdated = !isEdit && !!date;

  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [macros, setMacros] = useState({ protein: '', carbs: '', fat: '' });
  const [items, setItems] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [displayPhoto, setDisplayPhoto] = useState<string | undefined>(uri);
  // Local capture URIs pass through; an edited meal's stored Storage path is signed.
  const photoSrc = useSignedPhoto(displayPhoto);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { scrollRef, registerField, focusField } = useKeyboardAwareScroll();
  const insets = useSafeAreaInsets();

  // Edit mode: load the existing entry, prefill, no AI call.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getEntry(id).then((e) => {
      if (cancelled || !e) return;
      setName(e.name);
      setCalories(String(e.calories));
      setMacros({ protein: String(e.protein), carbs: String(e.carbs), fat: String(e.fat) });
      setItems(e.items ?? []);
      setDisplayPhoto(e.photoUri);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  function runAnalysis(photoUri: string) {
    let cancelled = false;
    setAnalyzing(true);
    setError(null);
    analyzeMeal(photoUri)
      .then((r) => {
        if (cancelled) return;
        setName(r.name);
        setCalories(String(r.calories));
        setMacros({ protein: String(r.protein), carbs: String(r.carbs), fat: String(r.fat) });
        setItems(r.items);
        setQty(1);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Analysis failed.');
      })
      .finally(() => {
        if (!cancelled) setAnalyzing(false);
      });
    return () => {
      cancelled = true;
    };
  }

  // New-meal mode: analyze the captured photo once.
  useEffect(() => {
    if (isEdit || !uri) return;
    return runAnalysis(uri);
  }, [uri, isEdit]);

  const perServing = {
    calories: numFromText(calories),
    protein: numFromText(macros.protein),
    carbs: numFromText(macros.carbs),
    fat: numFromText(macros.fat),
  };
  const total = {
    calories: perServing.calories * qty,
    protein: perServing.protein * qty,
    carbs: perServing.carbs * qty,
    fat: perServing.fat * qty,
  };

  async function save() {
    // Match the server-side CHECK bounds (numeric_bounds migration) with a friendly message
    // instead of letting the DB reject the insert. numFromText already floors at 0.
    if (total.calories > 100000 || total.protein > 10000 || total.carbs > 10000 || total.fat > 10000) {
      Alert.alert('Values too large', 'Double-check the calories and macros — those numbers look out of range.');
      return;
    }
    setSaving(true);
    try {
      const fields = { name: name.trim() || 'Meal', ...total };
      if (isEdit && id) {
        await updateEntry(id, fields);
      } else {
        const photoUri = uri ? await uploadMealPhoto(uri) : undefined;
        if (uri && !photoUri) {
          Alert.alert('Photo not uploaded', 'Your meal was saved, but the photo couldn’t be uploaded.');
        }
        let result;
        try {
          result = await addEntry({ ...fields, photoUri, items }, date);
        } catch (e) {
          if (photoUri) await deleteMealPhoto(photoUri); // don't orphan the just-uploaded photo
          throw e;
        }
        const { streakBefore, streakAfter } = result;
        if (streakAfter.current > streakBefore.current && streakAfter.current > 1) {
          congratulateStreak(streakAfter.current);
        }
      }
      if (process.env.EXPO_OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.dismissTo('/');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
    <ScrollView
      ref={scrollRef}
      style={{ backgroundColor: C.bg }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag">
      {photoSrc ? (
        <Image source={{ uri: photoSrc }} style={styles.photo} contentFit="cover" />
      ) : (
        <View style={[styles.photo, styles.photoEmpty]}>
          <IconSymbol name="fork.knife" size={40} color={C.faint} />
        </View>
      )}

      <View style={[cardStyle, styles.card]}>
        {analyzing ? (
          <View style={styles.statusRow}>
            <ActivityIndicator color={C.ink} />
            <Text style={styles.statusText}>Estimating nutrition…</Text>
          </View>
        ) : error ? (
          <Text selectable style={styles.errorText}>
            Couldn’t analyze the photo ({error}). Enter the values manually below.
          </Text>
        ) : null}

        <View style={styles.titleRow} ref={registerField('name')}>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            onFocus={() => focusField('name')}
            placeholder="Meal name"
            placeholderTextColor={C.faint}
          />
        </View>

        <View style={styles.calRow}>
          <ProgressRing size={72} stroke={9} progress={1} color={C.calorie}>
            <IconSymbol name="flame.fill" size={26} color={C.calorie} />
          </ProgressRing>
          <View style={styles.calMain}>
            <Text style={styles.calValue}>
              {total.calories}
              <Text style={styles.calUnit}> kcal</Text>
            </Text>
            <Text style={styles.calCaption}>Total calories{!isEdit && qty > 1 ? ` (×${qty})` : ''}</Text>
          </View>
          {/* Quantity multiplies a fresh per-serving estimate. In edit mode the stored
              values are already totals, so the stepper is hidden to avoid double-counting. */}
          {!isEdit ? (
            <View style={styles.stepper}>
              <Pressable
                style={[styles.stepBtn, qty <= 1 && styles.stepDisabled]}
                disabled={qty <= 1}
                onPress={() => setQty((q) => Math.max(1, q - 1))}
                hitSlop={8}>
                <IconSymbol name="minus" size={16} color={qty <= 1 ? C.faint : C.ink} />
              </Pressable>
              <Text style={styles.qty}>{qty}</Text>
              <Pressable style={styles.stepBtn} onPress={() => setQty((q) => q + 1)} hitSlop={8}>
                <IconSymbol name="plus" size={16} color={C.ink} />
              </Pressable>
            </View>
          ) : null}
        </View>

        <Text style={styles.groupLabel}>{isEdit ? 'Nutrition' : 'Per serving'}</Text>
        <View style={styles.editRow} ref={registerField('calories')}>
          <View style={[styles.dot, { backgroundColor: C.calorie }]} />
          <Text style={styles.editLabel}>Calories</Text>
          <TextInput
            style={styles.editInput}
            value={calories}
            onChangeText={setCalories}
            onFocus={() => focusField('calories')}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={C.faint}
          />
          <Text style={styles.editUnit}>kcal</Text>
        </View>
        {MACROS.map((m) => (
          <View key={m.key} style={styles.editRow} ref={registerField(m.key)}>
            <View style={[styles.dot, { backgroundColor: m.color }]} />
            <Text style={styles.editLabel}>{m.label}</Text>
            <TextInput
              style={styles.editInput}
              value={macros[m.key]}
              onChangeText={(t) => setMacros((s) => ({ ...s, [m.key]: t }))}
              onFocus={() => focusField(m.key)}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={C.faint}
            />
            <Text style={styles.editUnit}>g</Text>
          </View>
        ))}

        {items.length ? (
          <>
            <Text style={styles.groupLabel}>Ingredients</Text>
            <View style={styles.chips}>
              {items.map((it, i) => (
                <View key={`${it}-${i}`} style={styles.chip}>
                  <Text style={styles.chipText}>{it}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.actions}>
          {uri && !isEdit ? (
            <Pressable
              style={[styles.fixBtn, analyzing && styles.disabled]}
              disabled={analyzing}
              onPress={() => runAnalysis(uri)}>
              <IconSymbol name="square.and.pencil" size={16} color={C.ink} />
              <Text style={styles.fixText}>Fix Results</Text>
            </Pressable>
          ) : null}
          <Pressable style={[styles.done, saving && styles.disabled]} onPress={save} disabled={saving}>
            <Text style={styles.doneText}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : isBackdated ? 'Add to this day' : 'Done'}
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
      <Pressable
        style={[styles.close, { top: insets.top + 12 }]}
        onPress={() => router.back()}
        hitSlop={12}>
        <IconSymbol name="xmark" size={22} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 320 },
  photo: { width: '100%', height: 300, backgroundColor: C.hairline },
  photoEmpty: { alignItems: 'center', justifyContent: 'center' },
  card: { marginTop: -28, marginHorizontal: 12, padding: 20, gap: 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusText: { fontSize: 15, color: C.sub, fontFamily: font.medium },
  errorText: { color: '#C2410C', fontSize: 14, lineHeight: 20, fontFamily: font.medium },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  nameInput: { flex: 1, fontSize: 22, color: C.ink, fontFamily: font.bold, padding: 0 },
  calRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  calMain: { flex: 1 },
  calValue: { fontSize: 26, color: C.ink, fontFamily: font.extrabold, fontVariant: ['tabular-nums'] },
  calUnit: { fontSize: 15, color: C.faint, fontFamily: font.semibold },
  calCaption: { fontSize: 13, color: C.sub, fontFamily: font.medium },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.bg, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 5 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  stepDisabled: { opacity: 0.5 },
  qty: { fontSize: 16, color: C.ink, fontFamily: font.bold, fontVariant: ['tabular-nums'], minWidth: 14, textAlign: 'center' },
  groupLabel: { fontSize: 13, color: C.sub, fontFamily: font.semibold, marginTop: 2 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.hairline, borderRadius: 14, borderCurve: 'continuous', paddingHorizontal: 14, paddingVertical: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  editLabel: { flex: 1, fontSize: 15, color: C.ink, fontFamily: font.medium },
  editInput: { minWidth: 56, textAlign: 'right', fontSize: 16, color: C.ink, fontFamily: font.semibold, fontVariant: ['tabular-nums'] },
  editUnit: { fontSize: 13, color: C.faint, fontFamily: font.medium, width: 32 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: C.bg, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  chipText: { fontSize: 13, color: C.ink, fontFamily: font.medium },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  fixBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 15, paddingHorizontal: 18, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: C.hairline },
  fixText: { fontSize: 15, color: C.ink, fontFamily: font.semibold },
  done: { flex: 1, backgroundColor: C.ink, paddingVertical: 16, borderRadius: 16, borderCurve: 'continuous', alignItems: 'center' },
  doneText: { color: C.card, fontSize: 16, fontFamily: font.bold },
  disabled: { opacity: 0.6 },
  close: { position: 'absolute', left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
});
