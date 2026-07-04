import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { AuthScreen, ErrorText, Field, LinkButton, PrimaryButton } from '@/components/auth-ui';
import { C, font } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

/**
 * Email confirmation via 6-digit OTP. sign-up sends the code ({{ .Token }}) and navigates
 * here with the email. verifyOtp({ type: 'email' }) establishes the session, after which the
 * root auth gate flips to onboarding on its own — no manual navigation (this screen lives
 * inside the not-authed stack, so it unmounts when the session lands; that avoids the
 * protected-stack race reset-password has to work around as a root-level route). Works in
 * Expo Go where an external-browser confirmation deep-link can't reopen the app.
 */
export default function ConfirmEmailScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  // Reached without an email (e.g. a stale link) — nothing to verify against.
  if (!email) {
    return (
      <AuthScreen title="Confirm email" subtitle="Start from the sign-up screen">
        <PrimaryButton label="Back to sign up" onPress={() => router.replace('/auth/sign-up')} />
      </AuthScreen>
    );
  }

  async function submit() {
    if (code.trim().length !== 6) return setError('Enter the 6-digit code from your email.');
    setError(null);
    setBusy(true);
    const { error: otpErr } = await supabase.auth.verifyOtp({
      email: email!,
      token: code.trim(),
      type: 'email',
    });
    setBusy(false);
    if (otpErr) {
      return setError(
        otpErr.status === 429
          ? 'Too many attempts — wait a minute and request a new code.'
          : 'This code is invalid or has expired.'
      );
    }
    // Session established → the auth gate routes into onboarding automatically.
  }

  async function resend() {
    setError(null);
    setInfo(null);
    const { error: rErr } = await supabase.auth.resend({ type: 'signup', email: email! });
    // Generic outcome regardless of whether the email is unknown / already confirmed, so resend
    // can't be probed as an account-existence oracle. The only distinct signal is the
    // identity-agnostic rate limit (429).
    setInfo(
      rErr?.status === 429
        ? 'Please wait a minute before requesting another code.'
        : 'If your email needs confirming, a new code is on its way.'
    );
  }

  return (
    <AuthScreen title="Confirm your email" subtitle={`Enter the code we emailed to ${email}`}>
      <Field
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
        placeholder="6-digit code"
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <ErrorText>{error}</ErrorText>
      {info ? <Text style={{ color: C.sub, fontSize: 14, fontFamily: font.medium }}>{info}</Text> : null}
      <PrimaryButton label="Confirm" onPress={submit} loading={busy} />
      <LinkButton label="Resend code" onPress={resend} />
      <LinkButton label="Back to sign up" onPress={() => router.replace('/auth/sign-up')} />
    </AuthScreen>
  );
}
