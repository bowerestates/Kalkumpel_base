import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  InputAccessoryView,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useKeyboardAwareScroll } from '@/hooks/use-keyboard-aware-scroll';
import { Brand, Colors } from '@/constants/theme';
import { getProfile, setGoals, setProfile } from '@/lib/entries';
import {
  cmToFtIn,
  computePlan,
  ftInToCm,
  kgToLb,
  lbToKg,
} from '@/lib/nutrition-plan';
import { useOnboarding } from '@/lib/onboarding-state';
import { Activity, DEFAULT_PROFILE, Goal, Goals, Sex, Units } from '@/lib/types';

const GOALS: { key: Goal; label: string; hint: string }[] = [
  { key: 'lose', label: 'Lose weight', hint: '~0.5 kg / week deficit' },
  { key: 'maintain', label: 'Maintain', hint: 'Stay where you are' },
  { key: 'gain', label: 'Gain weight', hint: 'Steady surplus' },
  { key: 'muscle', label: 'Build muscle', hint: 'Lean bulk + high protein' },
];
const ACTIVITIES: { key: Activity; label: string; hint: string }[] = [
  { key: 'sedentary', label: 'Sedentary', hint: 'Little or no exercise' },
  { key: 'light', label: 'Light', hint: 'Exercise 1–3 days/week' },
  { key: 'moderate', label: 'Moderate', hint: 'Exercise 3–5 days/week' },
  { key: 'very', label: 'Very active', hint: 'Hard exercise 6–7 days/week' },
  { key: 'extra', label: 'Extra active', hint: 'Hard daily + physical job' },
];
const num = (s: string) => parseInt(s.replace(/[^0-9]/g, ''), 10) || 0;
const numF = (s: string) => parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
const ACCESSORY_ID = 'onboarding-fields'; // iOS keyboard toolbar (Next/Done)

export default function OnboardingScreen() {
  const { recompute } = useLocalSearchParams<{ recompute?: string }>();
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const track = scheme === 'dark' ? '#2A2D2E' : '#EFEFEF';
  const insets = useSafeAreaInsets();
  const { onboarded, setOnboarded } = useOnboarding();
  const { scrollRef, registerField, focusField } = useKeyboardAwareScroll();

  // An already-onboarded user who lands here without recompute intent (browser
  // back, a deep link, or a gate-timing redirect on login) is bounced home.
  useEffect(() => {
    if (onboarded && !recompute) router.replace('/');
  }, [onboarded, recompute]);

  // Field refs + focus tracking, so the keyboard toolbar can jump field→field.
  const inputs = useRef<Record<string, TextInput | null>>({});
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const [step, setStep] = useState(0); // 0 goal, 1 stats, 2 plan
  const [goal, setGoal] = useState<Goal>('maintain');
  const [sex, setSex] = useState<Sex>('male');
  const [units, setUnits] = useState<Units>('metric');
  const [age, setAge] = useState('30');
  // Per-unit buffers; the active set is converted to metric for the formula.
  const [heightCm, setHeightCm] = useState('175');
  const [heightFt, setHeightFt] = useState('5');
  const [heightIn, setHeightIn] = useState('9');
  const [weightKg, setWeightKg] = useState('75');
  const [weightLb, setWeightLb] = useState('165');
  const [activity, setActivity] = useState<Activity>('moderate');
  const [planInputs, setPlanInputs] = useState<Record<keyof Goals, string>>({
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
  });
  const [planMeta, setPlanMeta] = useState({ floored: false, compromised: false });

  // Recompute mode: prefill from the saved profile.
  useEffect(() => {
    if (!recompute) return;
    getProfile().then((p) => {
      setGoal(p.goal);
      setSex(p.sex);
      setUnits(p.units);
      setAge(String(p.age));
      setActivity(p.activity);
      setHeightCm(String(p.heightCm));
      setWeightKg(String(p.weightKg));
      const { ft, in: inch } = cmToFtIn(p.heightCm);
      setHeightFt(String(ft));
      setHeightIn(String(inch));
      setWeightLb(String(Math.round(kgToLb(p.weightKg))));
    });
  }, [recompute]);

  function switchUnits(next: Units) {
    if (next === units) return;
    if (next === 'imperial') {
      const { ft, in: inch } = cmToFtIn(num(heightCm));
      setHeightFt(String(ft));
      setHeightIn(String(inch));
      setWeightLb(String(Math.round(kgToLb(numF(weightKg)) * 10) / 10));
    } else {
      setHeightCm(String(Math.round(ftInToCm(num(heightFt), num(heightIn)))));
      setWeightKg(String(Math.round(lbToKg(numF(weightLb)) * 10) / 10));
    }
    setUnits(next);
  }

  function metricStats() {
    if (units === 'metric') return { heightCm: num(heightCm), weightKg: numF(weightKg) };
    return { heightCm: ftInToCm(num(heightFt), num(heightIn)), weightKg: lbToKg(numF(weightLb)) };
  }

  function buildProfile() {
    const m = metricStats();
    return {
      onboarded: true,
      sex,
      age: num(age),
      heightCm: Math.round(m.heightCm),
      weightKg: Math.round(m.weightKg * 10) / 10,
      activity,
      goal,
      units,
    };
  }

  function goToPlan() {
    const m = metricStats();
    // Lower bounds are UX-sane; the upper bounds also match the server CHECK constraints
    // (profiles: height_cm <= 300, weight_kg <= 1000) so a huge value gets a friendly
    // message here instead of a DB rejection on save.
    if (
      num(age) < 13 ||
      num(age) > 100 ||
      m.heightCm < 100 ||
      m.heightCm > 300 ||
      m.weightKg < 30 ||
      m.weightKg > 1000
    ) {
      Alert.alert('Check your details', 'Please enter a realistic age, height, and weight.');
      return;
    }
    const plan = computePlan(buildProfile());
    setPlanInputs({
      calories: String(plan.calories),
      protein: String(plan.protein),
      carbs: String(plan.carbs),
      fat: String(plan.fat),
    });
    setPlanMeta({ floored: plan.floored, compromised: plan.compromised });
    setStep(2);
  }

  async function finish() {
    // num() already strips to a non-negative int; guard the one field that must
    // be positive so a cleared calorie box can't save a 0-kcal goal.
    const goals = {
      calories: num(planInputs.calories),
      protein: num(planInputs.protein),
      carbs: num(planInputs.carbs),
      fat: num(planInputs.fat),
    };
    if (goals.calories <= 0) {
      Alert.alert('Set a calorie target', 'Calories must be greater than zero.');
      return;
    }
    // Upper bounds match the server CHECK constraints (goal_calories <= 100000, macros <= 10000).
    if (goals.calories > 100000 || goals.protein > 10000 || goals.carbs > 10000 || goals.fat > 10000) {
      Alert.alert('Values too large', 'Those targets look out of range — double-check them.');
      return;
    }
    await setProfile(buildProfile());
    await setGoals(goals);
    setOnboarded(true);
    router.replace('/');
  }

  async function skip() {
    await setProfile({ ...DEFAULT_PROFILE, onboarded: true });
    setOnboarded(true);
    router.replace('/');
  }

  // Ordered field keys for the current step (units changes the height fields),
  // used by the keyboard "Next" button to advance focus.
  const fieldOrder =
    step === 1
      ? units === 'metric'
        ? ['age', 'weight', 'heightCm']
        : ['age', 'weight', 'heightFt', 'heightIn']
      : step === 2
        ? ['calories', 'protein', 'carbs', 'fat']
        : [];
  const hasNext = focusedKey != null && fieldOrder.indexOf(focusedKey) < fieldOrder.length - 1;
  function focusNext() {
    if (focusedKey == null) return;
    const nextKey = fieldOrder[fieldOrder.indexOf(focusedKey) + 1];
    if (nextKey) inputs.current[nextKey]?.focus();
    else Keyboard.dismiss();
  }

  // --- small inline renderers (colors are in closure scope) ----------------
  const pill = (label: string, active: boolean, onPress: () => void, hint?: string) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={[
        styles.pill,
        { borderColor: active ? Brand.accent : track, backgroundColor: active ? Brand.accent : 'transparent' },
      ]}>
      <Text style={[styles.pillLabel, { color: active ? '#fff' : c.text }]}>{label}</Text>
      {hint ? (
        <Text style={[styles.pillHint, { color: active ? '#fff' : c.icon }]}>{hint}</Text>
      ) : null}
    </Pressable>
  );

  // fieldKey: ref + advance order; scrollKey: which container to scroll into view
  // on focus (the keyboard-aware hook measures Y relative to the direct child, so
  // side-by-side fields share their row's scrollKey).
  const numField = (
    fieldKey: string,
    scrollKey: string,
    label: string,
    value: string,
    set: (s: string) => void,
    unit: string,
    width?: number,
    decimal?: boolean
  ) => (
    <View style={[styles.field, width ? { width } : { flex: 1 }]}>
      <Text style={[styles.fieldLabel, { color: c.icon }]}>{label}</Text>
      <View style={[styles.inputWrap, { borderColor: track }]}>
        <TextInput
          ref={(r) => {
            inputs.current[fieldKey] = r;
          }}
          style={[styles.input, { color: c.text }]}
          value={value}
          onChangeText={(t) =>
            set(
              decimal
                ? // keep digits and a single decimal point
                  t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
                : t.replace(/[^0-9]/g, '')
            )
          }
          onFocus={() => {
            setFocusedKey(fieldKey);
            focusField(scrollKey);
          }}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          inputAccessoryViewID={process.env.EXPO_OS === 'ios' ? ACCESSORY_ID : undefined}
          // Android: the IME action advances to the next field (last → done).
          returnKeyType={fieldOrder.indexOf(fieldKey) === fieldOrder.length - 1 ? 'done' : 'next'}
          blurOnSubmit={fieldOrder.indexOf(fieldKey) === fieldOrder.length - 1}
          onSubmitEditing={() => {
            const nextKey = fieldOrder[fieldOrder.indexOf(fieldKey) + 1];
            if (nextKey) inputs.current[nextKey]?.focus();
            else Keyboard.dismiss();
          }}
          placeholder="0"
          placeholderTextColor={c.icon}
        />
        <Text style={[styles.unit, { color: c.icon }]}>{unit}</Text>
      </View>
    </View>
  );

  return (
    <ScrollView
      ref={scrollRef}
      style={{ backgroundColor: c.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag">
      <Text style={[styles.step, { color: c.icon }]}>Step {step + 1} of 3</Text>

      {step === 0 ? (
        <>
          <Text style={[styles.title, { color: c.text }]}>What’s your goal?</Text>
          <Text style={[styles.sub, { color: c.icon }]}>We’ll tailor a calorie & macro plan to it.</Text>
          <View style={styles.pillCol}>{GOALS.map((g) => pill(g.label, goal === g.key, () => setGoal(g.key), g.hint))}</View>
          <Pressable style={styles.primary} onPress={() => setStep(1)}>
            <Text style={styles.primaryText}>Continue</Text>
          </Pressable>
          {!recompute ? (
            <Pressable style={styles.skip} onPress={skip}>
              <Text style={[styles.skipText, { color: c.icon }]}>Skip — use default goals</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Text style={[styles.title, { color: c.text }]}>About you</Text>
          <Text style={[styles.sub, { color: c.icon }]}>Used to estimate your daily calorie needs.</Text>

          <Text style={[styles.groupLabel, { color: c.text }]}>Sex</Text>
          <View style={styles.pillRow}>
            {pill('Male', sex === 'male', () => setSex('male'))}
            {pill('Female', sex === 'female', () => setSex('female'))}
          </View>

          <Text style={[styles.groupLabel, { color: c.text }]}>Units</Text>
          <View style={styles.pillRow}>
            {pill('Metric', units === 'metric', () => switchUnits('metric'))}
            {pill('Imperial', units === 'imperial', () => switchUnits('imperial'))}
          </View>

          <View style={styles.fieldRow} ref={registerField('statsRow1')}>
            {numField('age', 'statsRow1', 'Age', age, setAge, 'yr', 96)}
            {units === 'metric'
              ? numField('weight', 'statsRow1', 'Weight', weightKg, setWeightKg, 'kg', undefined, true)
              : numField('weight', 'statsRow1', 'Weight', weightLb, setWeightLb, 'lb', undefined, true)}
          </View>

          {units === 'metric' ? (
            <View style={styles.fieldRow} ref={registerField('statsRow2')}>
              {numField('heightCm', 'statsRow2', 'Height', heightCm, setHeightCm, 'cm')}
            </View>
          ) : (
            <View style={styles.fieldRow} ref={registerField('statsRow2')}>
              {numField('heightFt', 'statsRow2', 'Height', heightFt, setHeightFt, 'ft', 110)}
              {numField('heightIn', 'statsRow2', ' ', heightIn, setHeightIn, 'in', 110)}
            </View>
          )}

          <Text style={[styles.groupLabel, { color: c.text }]}>Activity level</Text>
          <View style={styles.pillCol}>
            {ACTIVITIES.map((a) => pill(a.label, activity === a.key, () => setActivity(a.key), a.hint))}
          </View>

          <Pressable style={styles.primary} onPress={goToPlan}>
            <Text style={styles.primaryText}>See my plan</Text>
          </Pressable>
          <Pressable style={styles.skip} onPress={() => setStep(0)}>
            <Text style={[styles.skipText, { color: c.icon }]}>Back</Text>
          </Pressable>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Text style={[styles.title, { color: c.text }]}>Your recommended plan</Text>
          <Text style={[styles.sub, { color: c.icon }]}>
            An estimate from your stats — adjust anything, then fine-tune after ~2 weeks of tracking.
          </Text>

          {planMeta.floored ? (
            <Text style={[styles.warn, { color: '#C2410C' }]} selectable>
              Heads up: your target was raised to the safe minimum for your sex. Consider a gentler goal or more
              activity.
            </Text>
          ) : null}
          {planMeta.compromised ? (
            <Text style={[styles.warn, { color: '#C2410C' }]} selectable>
              Protein/fat were trimmed to fit these calories.
            </Text>
          ) : null}

          <View ref={registerField('planCal')}>
            {numField('calories', 'planCal', 'Calories', planInputs.calories, (t) => setPlanInputs((p) => ({ ...p, calories: t })), 'kcal')}
          </View>
          <View style={styles.fieldRow} ref={registerField('planMacros')}>
            {numField('protein', 'planMacros', 'Protein', planInputs.protein, (t) => setPlanInputs((p) => ({ ...p, protein: t })), 'g')}
            {numField('carbs', 'planMacros', 'Carbs', planInputs.carbs, (t) => setPlanInputs((p) => ({ ...p, carbs: t })), 'g')}
            {numField('fat', 'planMacros', 'Fat', planInputs.fat, (t) => setPlanInputs((p) => ({ ...p, fat: t })), 'g')}
          </View>

          <Pressable style={styles.primary} onPress={finish}>
            <Text style={styles.primaryText}>{recompute ? 'Update my plan' : "Let's go"}</Text>
          </Pressable>
          <Pressable style={styles.skip} onPress={() => setStep(1)}>
            <Text style={[styles.skipText, { color: c.icon }]}>Back</Text>
          </Pressable>
        </>
      ) : null}

      {/* iOS number pads have no return key, so a toolbar provides Next/Done.
          Android has no InputAccessoryView; the keyboard-aware scroll keeps the
          focused field visible there and users tap the next field. */}
      {process.env.EXPO_OS === 'ios' ? (
        <InputAccessoryView nativeID={ACCESSORY_ID}>
          <View style={[styles.accessory, { backgroundColor: track }]}>
            <Pressable onPress={() => Keyboard.dismiss()} hitSlop={8}>
              <Text style={[styles.accessoryBtn, { color: c.icon }]}>Done</Text>
            </Pressable>
            {hasNext ? (
              <Pressable onPress={focusNext} hitSlop={8}>
                <Text style={[styles.accessoryBtn, { color: Brand.accent }]}>Next</Text>
              </Pressable>
            ) : null}
          </View>
        </InputAccessoryView>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 12 },
  step: { fontSize: 13, fontWeight: '600' },
  title: { fontSize: 30, fontWeight: '800' },
  sub: { fontSize: 15, lineHeight: 20, marginBottom: 4 },
  groupLabel: { fontSize: 15, fontWeight: '700', marginTop: 8 },
  pillCol: { gap: 10 },
  pillRow: { flexDirection: 'row', gap: 10 },
  pill: { flex: 1, borderWidth: 1.5, borderRadius: 14, borderCurve: 'continuous', paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', gap: 2 },
  pillLabel: { fontSize: 16, fontWeight: '700' },
  pillHint: { fontSize: 12 },
  fieldRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, borderCurve: 'continuous', paddingHorizontal: 14 },
  input: { flex: 1, paddingVertical: 12, fontSize: 16, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 14 },
  warn: { fontSize: 14, lineHeight: 19 },
  primary: { backgroundColor: Brand.accent, paddingVertical: 16, borderRadius: 16, borderCurve: 'continuous', alignItems: 'center', marginTop: 12 },
  primaryText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  skip: { alignItems: 'center', paddingVertical: 8 },
  skipText: { fontSize: 15, fontWeight: '600' },
  accessory: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  accessoryBtn: { fontSize: 16, fontWeight: '700' },
});
