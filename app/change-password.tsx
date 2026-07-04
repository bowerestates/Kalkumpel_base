import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput } from 'react-native';

import { AuthScreen, ErrorText, Field, LinkButton, PrimaryButton } from '@/components/auth-ui';
import { hasPasswordIdentity, useAuth } from '@/lib/auth-state';
import { supabase } from '@/lib/supabase';
import { passwordError } from '@/lib/validation';

/** Modal from Settings — password-identity users only. Re-verifies the current
 *  password before setting a new one. */
export default function ChangePasswordScreen() {
  const { user } = useAuth();
  const needsCurrent = hasPasswordIdentity(user);

  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  async function submit() {
    const pwErr = passwordError(password, confirm);
    if (pwErr) return setError(pwErr);
    setError(null);
    setBusy(true);

    if (needsCurrent) {
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: user?.email ?? '',
        password: current,
      });
      if (reauthErr) {
        setBusy(false);
        return setError('Current password is incorrect.');
      }
    }

    const { error: updErr } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updErr) return setError(updErr.message);
    router.back();
  }

  return (
    <AuthScreen title="Change password" subtitle="Update your account password">
      {needsCurrent ? (
        <Field
          value={current}
          onChangeText={setCurrent}
          placeholder="Current password"
          icon="lock"
          secure
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
      ) : null}
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
      <PrimaryButton label="Update password" onPress={submit} loading={busy} />
      <LinkButton label="Cancel" onPress={() => router.back()} />
    </AuthScreen>
  );
}
