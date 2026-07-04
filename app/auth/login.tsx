import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthScreen, Divider, ErrorText, Field, GhostButton, LinkButton, PrimaryButton } from '@/components/auth-ui';
import { C, font } from '@/constants/theme';
import { signInWithGoogle } from '@/lib/oauth';
import { supabase } from '@/lib/supabase';
import { isValidEmail } from '@/lib/validation';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  async function login() {
    if (!isValidEmail(email)) return setError('Enter a valid email address.');
    if (!password) return setError('Enter your password.');
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      // Correct credentials but the email was never confirmed. This only triggers when the
      // password is right (not an enumeration oracle), so it's safe to send them to finish
      // confirmation. Every other failure gets one generic message so we don't reveal whether
      // the email is registered.
      if (error.code === 'email_not_confirmed') {
        supabase.auth.resend({ type: 'signup', email: email.trim() }).catch(() => {});
        router.push({ pathname: '/auth/confirm-email', params: { email: email.trim() } });
        return;
      }
      setError('Invalid email or password.');
    }
    // success → onAuthStateChange flips the gate (no manual navigation)
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
    <AuthScreen title="Welcome back" subtitle="Log in to your account">
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
        returnKeyType="go"
        onSubmitEditing={login}
      />
      <View style={{ alignItems: 'flex-end' }}>
        <LinkButton label="Forgot password?" onPress={() => router.push('/auth/forgot-password')} />
      </View>
      <ErrorText>{error}</ErrorText>
      <PrimaryButton label="Login" onPress={login} loading={busy} />
      <Divider />
      <GhostButton label="Continue with Google" onPress={google} />
      <View style={styles.bottom}>
        <Text style={styles.muted}>Don’t have an account?</Text>
        <LinkButton label="Sign up" onPress={() => router.push('/auth/sign-up')} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  bottom: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 8 },
  muted: { color: C.sub, fontSize: 15, fontFamily: font.medium },
});
