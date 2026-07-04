import { forwardRef, ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

import { C, cardStyle, font } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppLogo } from '@/components/app-logo';

/** Shared building blocks for the auth screens (login / sign-up / reset / change). */

export function AuthScreen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  // KeyboardAvoidingView shrinks the scroll area when the keyboard opens so the
  // focused field (e.g. the lowest "Confirm password" on reset) can scroll above it.
  // One mechanism only — pairing this with the ScrollView's automaticallyAdjustKeyboardInsets
  // would double the bottom inset on iOS. behavior is set on both platforms.
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={{ flex: 1, backgroundColor: C.bg }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <View style={styles.logoWrap}>
          <AppLogo />
        </View>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <View style={styles.form}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// forwardRef so screens can focus the next field on "Next" (keyboard return key chaining).
export const Field = forwardRef<
  TextInput,
  {
    value: string;
    onChangeText: (t: string) => void;
    placeholder: string;
    icon?: Parameters<typeof IconSymbol>[0]['name'];
    secure?: boolean;
  } & Omit<TextInputProps, 'value' | 'onChangeText' | 'placeholder'>
>(function Field({ value, onChangeText, placeholder, icon, secure, ...rest }, ref) {
  const [hidden, setHidden] = useState(!!secure);
  return (
    <View style={[cardStyle, styles.field]}>
      {icon ? <IconSymbol name={icon} size={18} color={C.faint} /> : null}
      <TextInput
        ref={ref}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.faint}
        secureTextEntry={hidden}
        autoCapitalize="none"
        autoCorrect={false}
        {...rest}
      />
      {secure ? (
        <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10}>
          <IconSymbol name={hidden ? 'eye.slash' : 'eye'} size={18} color={C.faint} />
        </Pressable>
      ) : null}
    </View>
  );
});

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.primary, (disabled || loading) && styles.primaryDisabled]}
      onPress={onPress}
      disabled={disabled || loading}>
      {loading ? <ActivityIndicator color={C.card} /> : <Text style={styles.primaryText}>{label}</Text>}
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  icon,
  disabled,
}: {
  label: string;
  onPress: () => void;
  icon?: Parameters<typeof IconSymbol>[0]['name'];
  disabled?: boolean;
}) {
  return (
    <Pressable style={[styles.ghost, disabled && styles.primaryDisabled]} onPress={onPress} disabled={disabled}>
      {icon ? <IconSymbol name={icon} size={18} color={C.ink} /> : null}
      <Text style={styles.ghostText}>{label}</Text>
    </Pressable>
  );
}

export function Divider({ label = 'Or' }: { label?: string }) {
  return (
    <View style={styles.divider}>
      <View style={styles.line} />
      <Text style={styles.dividerText}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <Text selectable style={styles.error}>
      {children}
    </Text>
  );
}

export function LinkButton({ label, onPress, color }: { label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text style={[styles.link, color ? { color } : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingTop: 60, gap: 14, flexGrow: 1 },
  logoWrap: { alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 30, color: C.ink, fontFamily: font.extrabold, letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { fontSize: 15, color: C.sub, fontFamily: font.medium, textAlign: 'center', marginTop: -4 },
  form: { gap: 12, marginTop: 10 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  input: { flex: 1, fontSize: 16, color: C.ink, fontFamily: font.medium },
  primary: {
    backgroundColor: C.ink,
    paddingVertical: 16,
    borderRadius: 16,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { color: C.card, fontSize: 16, fontFamily: font.bold },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: C.hairline,
    backgroundColor: C.card,
  },
  ghostText: { color: C.ink, fontSize: 16, fontFamily: font.semibold },
  error: { color: C.danger, fontSize: 14, fontFamily: font.medium, lineHeight: 19 },
  link: { color: C.fat, fontSize: 15, fontFamily: font.semibold, textAlign: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 2 },
  line: { flex: 1, height: 1, backgroundColor: C.hairline },
  dividerText: { color: C.faint, fontSize: 13, fontFamily: font.medium },
});
