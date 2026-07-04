import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthScreen, Divider, ErrorText, Field, GhostButton, LinkButton, PrimaryButton } from '@/components/auth-ui';
import { C, font } from '@/constants/theme';
import { signInWithGoogle } from '@/lib/oauth';
import { supabase } from '@/lib/supabase';
import { isValidEmail, passwordError } from '@/lib/validation';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  async function signUp() {
    if (!isValidEmail(email)) return setError('Enter a valid email address.');
    const pwErr = passwordError(password, confirm);
    if (pwErr) return setError(pwErr);
    setError(null);
    setBusy(true);
    // Email confirmation is ON → signUp returns NO session and emails a 6-digit code.
    // (With confirmations on, Supabase obfuscates existing-email signups instead of erroring,
    // so no enumeration leak here; a surfaced error is a weak password / network / rate limit.)
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (error) return setError(error.message);
    router.push({ pathname: '/auth/confirm-email', params: { email: email.trim() } });
  }

  async function google() {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed.');
    }
  }

  return (
    <AuthScreen title="Create account" subtitle="Start tracking your meals">
      <Field
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        icon="envelope"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <Field
        ref={passwordRef}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        icon="lock"
        secure
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      <Field
        ref={confirmRef}
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Confirm password"
        icon="lock"
        secure
        returnKeyType="go"
        onSubmitEditing={signUp}
      />
      <ErrorText>{error}</ErrorText>
      <PrimaryButton label="Sign up" onPress={signUp} loading={busy} />
      <Divider />
      <GhostButton label="Continue with Google" onPress={google} />
      <View style={styles.bottom}>
        <Text style={styles.muted}>Already have an account?</Text>
        <LinkButton label="Login" onPress={() => router.replace('/auth/login')} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  bottom: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 8 },
  muted: { color: C.sub, fontSize: 15, fontFamily: font.medium },
});
