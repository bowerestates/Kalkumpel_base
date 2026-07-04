import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { C, cardStyle, font } from '@/constants/theme';
import { useKeyboardAwareScroll } from '@/hooks/use-keyboard-aware-scroll';
import { hasPasswordIdentity, useAuth } from '@/lib/auth-state';
import { getGoals, resetAllData, setGoals as persistGoals } from '@/lib/entries';
import { applyReminders, cancelAllReminders, getPrefs } from '@/lib/notifications';
import { useOnboarding } from '@/lib/onboarding-state';
import { deleteAllMealPhotos } from '@/lib/photo-storage';
import { queryClient } from '@/lib/query';
import { supabase } from '@/lib/supabase';
import { DEFAULT_GOALS, DEFAULT_PREFS, Goals, Prefs } from '@/lib/types';

const GOAL_FIELDS: { key: keyof Goals; label: string; unit: string; color: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal', color: C.calorie },
  { key: 'protein', label: 'Protein', unit: 'g', color: C.protein },
  { key: 'carbs', label: 'Carbs', unit: 'g', color: C.carbs },
  { key: 'fat', label: 'Fat', unit: 'g', color: C.fat },
];

function fmtTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

type GoalInputs = Record<keyof Goals, string>;
const toInputs = (g: Goals): GoalInputs => ({
  calories: String(g.calories),
  protein: String(g.protein),
  carbs: String(g.carbs),
  fat: String(g.fat),
});

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = process.env.EXPO_OS === 'android' ? insets.top + 12 : 20;

  const [goalInputs, setGoalInputs] = useState<GoalInputs>(toInputs(DEFAULT_GOALS));
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [savedNote, setSavedNote] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const { setOnboarded } = useOnboarding();
  const { user } = useAuth();
  const canChangePassword = hasPasswordIdentity(user);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePw, setDeletePw] = useState('');
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { scrollRef, registerField, focusField } = useKeyboardAwareScroll();

  useFocusEffect(
    useCallback(() => {
      getGoals().then((g) => setGoalInputs(toInputs(g)));
      getPrefs().then(setPrefs);
    }, [])
  );

  function editGoal(key: keyof Goals, text: string) {
    setGoalInputs((g) => ({ ...g, [key]: text.replace(/[^0-9]/g, '') }));
  }

  async function saveGoals() {
    const goals: Goals = {
      calories: parseInt(goalInputs.calories, 10) || 0,
      protein: parseInt(goalInputs.protein, 10) || 0,
      carbs: parseInt(goalInputs.carbs, 10) || 0,
      fat: parseInt(goalInputs.fat, 10) || 0,
    };
    await persistGoals(goals);
    setGoalInputs(toInputs(goals));
    setSavedNote(true);
    setTimeout(() => setSavedNote(false), 1500);
  }

  async function commit(next: Prefs) {
    setPrefs(next);
    const applied = await applyReminders(next);
    setPrefs(applied);
    return applied;
  }

  async function toggleReminders(value: boolean) {
    const applied = await commit({ ...prefs, remindersEnabled: value });
    if (value && applied.reminders.length > 0 && applied.scheduledNotificationIds.length === 0) {
      Alert.alert('Notifications blocked', 'Enable notifications for this app in system settings.');
    }
  }

  function addReminder() {
    const now = new Date();
    const id = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    commit({
      ...prefs,
      reminders: [...prefs.reminders, { id, label: 'Reminder', hour: now.getHours(), minute: now.getMinutes() }],
    });
  }

  function removeReminder(id: string) {
    commit({ ...prefs, reminders: prefs.reminders.filter((r) => r.id !== id) });
  }

  function renameReminder(id: string, label: string) {
    setPrefs((p) => ({ ...p, reminders: p.reminders.map((r) => (r.id === id ? { ...r, label } : r)) }));
  }

  function setReminderTime(id: string, selected: Date): Prefs {
    return {
      ...prefs,
      reminders: prefs.reminders.map((r) =>
        r.id === id ? { ...r, hour: selected.getHours(), minute: selected.getMinutes() } : r
      ),
    };
  }

  function onTimeChange(event: DateTimePickerEvent, selected?: Date) {
    const id = editingId;
    if (process.env.EXPO_OS === 'android') {
      setEditingId(null);
      if (event.type === 'dismissed' || !selected || !id) return;
      commit(setReminderTime(id, selected));
    } else if (selected && id) {
      setPrefs(setReminderTime(id, selected));
    }
  }

  function closePicker() {
    setEditingId(null);
    commit(prefs);
  }

  // Custom modal instead of Alert.alert: RN-web doesn't fire Alert button
  // callbacks, so the destructive action never ran there.
  async function doReset() {
    setResetOpen(false);
    await cancelAllReminders();
    await resetAllData();
    queryClient.clear(); // drop cached meals/goals so reset data doesn't linger
    setGoalInputs(toInputs(DEFAULT_GOALS));
    setPrefs(DEFAULT_PREFS);
    setOnboarded(false);
  }

  async function logout() {
    await cancelAllReminders().catch(() => {});
    await supabase.auth.signOut();
  }

  // Account deletion is irreversible. Password users re-enter their password as a
  // confirmation; a Google user's current session already proves identity, so the modal's
  // explicit confirm is enough — no disruptive Google re-consent / browser round-trip.
  async function confirmDelete() {
    setDeleteErr(null);
    setDeleting(true);
    try {
      if (canChangePassword) {
        const { error } = await supabase.auth.signInWithPassword({
          email: user?.email ?? '',
          password: deletePw,
        });
        if (error) {
          setDeleteErr('Current password is incorrect.');
          setDeleting(false);
          return;
        }
      }
      // Storage isn't in the DB cascade — clear the user's photos before deleting.
      if (user?.id) await deleteAllMealPhotos(user.id);
      const { error } = await supabase.rpc('delete_user');
      if (error) throw error;
      await cancelAllReminders().catch(() => {});
      // Wipe ALL local state so a future sign-up starts genuinely fresh: otherwise migrate-local
      // re-imports the old on-device profile (onboarded=true) + meals/weights and skips onboarding.
      // Clears the legacy KV store, the `migratedTo` flag, and the persisted query cache. Best-effort.
      queryClient.clear();
      await AsyncStorage.clear().catch(() => {});
      // Local scope: the user no longer exists, so a server-side logout would 403.
      await supabase.auth.signOut({ scope: 'local' }); // gate flips to auth; screen unmounts
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : 'Could not delete account.');
      setDeleting(false);
    }
  }

  const editingReminder = prefs.reminders.find((r) => r.id === editingId);
  const pickerValue = (() => {
    const d = new Date();
    if (editingReminder) d.setHours(editingReminder.hour, editingReminder.minute, 0, 0);
    return d;
  })();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        ref={scrollRef}
        style={{ backgroundColor: C.bg }}
        contentContainerStyle={[styles.content, { paddingTop: topPad }]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Settings</Text>

        <Text style={styles.section}>Daily goals</Text>
        <View style={styles.group}>
          {GOAL_FIELDS.map(({ key, label, unit, color }) => (
            <View key={key} style={[cardStyle, styles.row]} ref={registerField(key)}>
              <View style={[styles.dot, { backgroundColor: color }]} />
              <Text style={styles.rowLabel}>{label}</Text>
              <TextInput
                style={styles.input}
                value={goalInputs[key]}
                onChangeText={(t) => editGoal(key, t)}
                onFocus={() => focusField(key)}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={C.faint}
              />
              <Text style={styles.unit}>{unit}</Text>
            </View>
          ))}
        </View>
        <Pressable style={styles.save} onPress={saveGoals}>
          <Text style={styles.saveText}>{savedNote ? 'Saved ✓' : 'Save goals'}</Text>
        </Pressable>

        <Text style={styles.section}>Reminders</Text>
        <View style={[cardStyle, styles.row]}>
          <Pressable style={styles.toggleHit} onPress={() => toggleReminders(!prefs.remindersEnabled)}>
            <Text style={styles.rowLabel}>Daily meal reminders</Text>
          </Pressable>
          <Switch
            value={prefs.remindersEnabled}
            onValueChange={toggleReminders}
            trackColor={{ true: C.ink }}
          />
        </View>
        {prefs.remindersEnabled ? (
          <View style={styles.group}>
            {prefs.reminders.map((r) => (
              <View key={r.id} style={[cardStyle, styles.row]} ref={registerField(`reminder-${r.id}`)}>
                <TextInput
                  style={styles.reminderName}
                  value={r.label}
                  onChangeText={(t) => renameReminder(r.id, t)}
                  onFocus={() => focusField(`reminder-${r.id}`)}
                  onEndEditing={() => commit(prefs)}
                  placeholder="Reminder"
                  placeholderTextColor={C.faint}
                />
                <Pressable onPress={() => setEditingId(r.id)} hitSlop={8}>
                  <Text style={styles.timeText}>{fmtTime(r.hour, r.minute)}</Text>
                </Pressable>
                <Pressable onPress={() => removeReminder(r.id)} hitSlop={10} style={styles.del}>
                  <IconSymbol name="trash" size={18} color={C.faint} />
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.addReminder} onPress={addReminder}>
              <IconSymbol name="plus.circle.fill" size={18} color={C.ink} />
              <Text style={styles.addReminderText}>Add reminder</Text>
            </Pressable>
            <Text style={styles.note}>Tap a time to change it. Tap a name to rename.</Text>
          </View>
        ) : null}

        <Text style={styles.section}>Plan</Text>
        <Pressable style={[cardStyle, styles.row]} onPress={() => router.push('/onboarding?recompute=1')}>
          <Text style={styles.rowLabel}>Recalculate my plan</Text>
          <IconSymbol name="chevron.right" size={16} color={C.faint} />
        </Pressable>

        <Text style={styles.section}>Account</Text>
        {user?.email ? (
          <View style={[cardStyle, styles.row]}>
            <IconSymbol name="person.crop.circle" size={20} color={C.sub} />
            <Text style={styles.rowLabel} numberOfLines={1}>
              {user.email}
            </Text>
          </View>
        ) : null}
        {canChangePassword ? (
          <Pressable style={[cardStyle, styles.row]} onPress={() => router.push('/change-password')}>
            <Text style={styles.rowLabel}>Change password</Text>
            <IconSymbol name="chevron.right" size={16} color={C.faint} />
          </Pressable>
        ) : null}
        <Pressable style={[cardStyle, styles.row]} onPress={logout}>
          <Text style={[styles.rowLabel, { color: C.danger }]}>Log out</Text>
          <IconSymbol name="rectangle.portrait.and.arrow.right" size={18} color={C.danger} />
        </Pressable>

        <Text style={styles.section}>Data</Text>
        <Pressable style={styles.reset} onPress={() => setResetOpen(true)}>
          <Text style={styles.resetText}>Reset all data</Text>
        </Pressable>
        <Pressable style={styles.reset} onPress={() => setDeleteOpen(true)}>
          <Text style={styles.resetText}>Delete account</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={resetOpen} transparent animationType="fade" onRequestClose={() => setResetOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setResetOpen(false)}>
          <Pressable style={[cardStyle, styles.resetCard]} onPress={() => {}}>
            <Text style={styles.resetTitle}>Reset all data?</Text>
            <Text style={styles.resetBody}>
              This deletes every logged meal, your goals, plan, and streak, and restarts onboarding.
            </Text>
            <Pressable style={styles.resetConfirm} onPress={doReset}>
              <Text style={styles.resetConfirmText}>Reset everything</Text>
            </Pressable>
            <Pressable style={styles.resetCancel} onPress={() => setResetOpen(false)}>
              <Text style={styles.resetCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setDeleteOpen(false)}>
          <Pressable style={[cardStyle, styles.resetCard]} onPress={() => {}}>
            <Text style={styles.resetTitle}>Delete account?</Text>
            <Text style={styles.resetBody}>
              This permanently deletes your account and all your data across devices. This cannot be undone.
            </Text>
            {canChangePassword ? (
              <TextInput
                style={styles.deleteInput}
                value={deletePw}
                onChangeText={setDeletePw}
                placeholder="Current password"
                placeholderTextColor={C.faint}
                secureTextEntry
                autoCapitalize="none"
              />
            ) : null}
            {deleteErr ? (
              <Text selectable style={styles.deleteErr}>
                {deleteErr}
              </Text>
            ) : null}
            <Pressable style={styles.resetConfirm} onPress={confirmDelete} disabled={deleting}>
              <Text style={styles.resetConfirmText}>{deleting ? 'Deleting…' : 'Delete my account'}</Text>
            </Pressable>
            <Pressable style={styles.resetCancel} onPress={() => setDeleteOpen(false)}>
              <Text style={styles.resetCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {editingId && process.env.EXPO_OS === 'android' ? (
        <DateTimePicker value={pickerValue} mode="time" onChange={onTimeChange} />
      ) : null}
      <Modal
        visible={!!editingId && process.env.EXPO_OS !== 'android'}
        transparent
        animationType="fade"
        onRequestClose={closePicker}>
        <Pressable style={styles.backdrop} onPress={closePicker}>
          <Pressable style={[cardStyle, styles.pickerCard]} onPress={() => {}}>
            <DateTimePicker value={pickerValue} mode="time" display="spinner" onChange={onTimeChange} />
            <Pressable style={styles.save} onPress={closePicker}>
              <Text style={styles.saveText}>Done</Text>
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
  content: { padding: 20, gap: 10, paddingBottom: 340 },
  title: { fontSize: 32, color: C.ink, fontFamily: font.extrabold, letterSpacing: -0.5 },
  section: { fontSize: 16, color: C.ink, fontFamily: font.bold, marginTop: 14, marginBottom: 2 },
  group: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowLabel: { flex: 1, fontSize: 16, color: C.ink, fontFamily: font.medium },
  toggleHit: { flex: 1, paddingVertical: 2 },
  input: { minWidth: 70, textAlign: 'right', fontSize: 16, color: C.ink, fontFamily: font.semibold, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 14, color: C.faint, fontFamily: font.medium, width: 36 },
  timeText: { fontSize: 16, color: C.ink, fontFamily: font.bold, fontVariant: ['tabular-nums'] },
  reminderName: { flex: 1, fontSize: 16, color: C.ink, fontFamily: font.medium },
  del: { padding: 4 },
  addReminder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.faint,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingVertical: 14,
  },
  addReminderText: { fontSize: 15, color: C.ink, fontFamily: font.semibold },
  backdrop: { flex: 1, backgroundColor: '#0007', justifyContent: 'center', alignItems: 'center', padding: 24 },
  pickerCard: { width: '100%', padding: 16, gap: 8, alignItems: 'center' },
  note: { fontSize: 13, lineHeight: 18, paddingHorizontal: 4, color: C.faint, fontFamily: font.medium },
  save: { backgroundColor: C.ink, paddingVertical: 15, borderRadius: 16, borderCurve: 'continuous', alignItems: 'center', marginTop: 6 },
  saveText: { color: C.card, fontSize: 16, fontFamily: font.bold },
  reset: { borderWidth: 1, borderColor: C.danger, paddingVertical: 15, borderRadius: 16, borderCurve: 'continuous', alignItems: 'center' },
  resetText: { color: C.danger, fontSize: 16, fontFamily: font.bold },
  resetCard: { width: '100%', padding: 22, gap: 12 },
  resetTitle: { fontSize: 18, color: C.ink, fontFamily: font.bold },
  resetBody: { fontSize: 14, lineHeight: 20, color: C.sub, fontFamily: font.medium },
  resetConfirm: { backgroundColor: C.danger, paddingVertical: 14, borderRadius: 14, borderCurve: 'continuous', alignItems: 'center', marginTop: 4 },
  resetConfirmText: { color: '#fff', fontSize: 16, fontFamily: font.bold },
  resetCancel: { paddingVertical: 12, alignItems: 'center' },
  resetCancelText: { color: C.sub, fontSize: 15, fontFamily: font.semibold },
  deleteInput: {
    borderWidth: 1,
    borderColor: C.hairline,
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: C.ink,
    fontFamily: font.medium,
  },
  deleteErr: { color: C.danger, fontSize: 13, fontFamily: font.medium },
});
