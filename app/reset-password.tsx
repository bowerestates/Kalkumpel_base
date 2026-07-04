import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { TextInput } from 'react-native';

import { AuthScreen, ErrorText, Field, LinkButton, PrimaryButton } from '@/components/auth-ui';
import { BrandLoading } from '@/components/brand-loading';
import { useAuth } from '@/lib/auth-state';
import { useOnboarding } from '@/lib/onboarding-state';
import { supabase } from '@/lib/supabase';
import { passwordError } from '@/lib/validation';

/**
 * Password recovery via 6-digit OTP. forgot-password sends the code ({{ .Token }})
 * and navigates here with the email. We verify the code (verifyOtp → recovery
 * session) then set the new password (updateUser). No deep link / browser, so it
 * works in Expo Go where an external-browser redirect can't reopen the app.
 */
export default function ResetPasswordScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { user } = useAuth();
  const { ready: onbReady, onboarded } = useOnboarding();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const verified = useRef(false); // a recovery session was established via verifyOtp
  const succeeded = useRef(false); // the password was actually changed

  // verifyOtp leaves a live recovery session. If the user leaves after verifying but
  // before finishing the reset, sign it out so the verified-but-unused session can't
  // admit them to the app. Gated on `verified` so we never sign out an unrelated logged-in
  // user (e.g. on the no-email fallback). ponytail: covers navigate-away; a hard app kill
  // keeps the session, which is acceptable — the OTP already proved email ownership.
  useEffect(() => {
    return () => {
      if (verified.current && !succeeded.current) supabase.auth.signOut();
    };
  }, []);

  // After a successful reset the user is now signed in (verifyOtp session). Navigate only
  // once the session AND this user's onboarding profile have settled, so the destination
  // route is actually mounted — a synchronous router.replace('/') here crashes with
  // "REPLACE (tabs) not handled" because the auth gate hasn't mounted (tabs)/onboarding yet.
  useEffect(() => {
    if (done && user && onbReady) router.replace(onboarded ? '/' : '/onboarding');
  }, [done, user, onbReady, onboarded]);

  // Password changed — show a clean full-screen loading while the auth gate settles and
  // the nav effect routes into the app. Without this, the auth group tearing down (login
  // sliding out) can flash for a frame if the profile/migration resolves before the root
  // overlay would otherwise cover it.
  if (done) return <BrandLoading />;

  // Reached without an email (e.g. an old deep link) — nothing to verify against.
  if (!email) {
    return (
      <AuthScreen title="Reset password" subtitle="Start the password reset from the login screen">
        <PrimaryButton label="Back to reset password" onPress={() => router.replace('/auth/forgot-password')} />
      </AuthScreen>
    );
  }

  async function submit() {
    const pwErr = passwordError(password, confirm);
    if (pwErr) return setError(pwErr); // don't burn an OTP attempt on a bad password
    if (code.trim().length !== 6) return setError('Enter the 6-digit code from your email.');
    setError(null);
    setBusy(true);
    try {
      // verifyOtp establishes a recovery session; updateUser then sets the password.
      const { error: otpErr } = await supabase.auth.verifyOtp({
        email: email!,
        token: code.trim(),
        type: 'recovery',
      });
      if (otpErr) {
        return setError(
          otpErr.status === 429
            ? 'Too many attempts — wait a minute and request a new code.'
            : 'This code is invalid or has expired.'
        );
      }
      verified.current = true; // recovery session now live — the unmount guard owns cleanup
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) {
        // A recovery session is now live; sign it out so the auth gate can't drop the
        // user into the app without actually having changed their password.
        await supabase.auth.signOut();
        return setError(updErr.message);
      }
      succeeded.current = true; // keep the now-valid session; the unmount guard won't sign out
      setDone(true); // the nav effect routes once the gate is ready (avoids the (tabs) race)
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScreen title="New password" subtitle={`Enter the code we emailed to ${email}`}>
      <Field
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
        placeholder="6-digit code"
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <Field
        ref={passwordRef}
        value={password}
        onChangeText={setPassword}
        placeholder="New password"
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
        placeholder="Confirm new password"
        icon="lock"
        secure
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <ErrorText>{error}</ErrorText>
      <PrimaryButton label="Update password" onPress={submit} loading={busy || done} />
      <LinkButton label="Back to login" onPress={() => router.replace('/auth/login')} />
    </AuthScreen>
  );
}
