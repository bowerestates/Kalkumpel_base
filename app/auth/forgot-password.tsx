import { router } from 'expo-router';
import { useState } from 'react';

import { AuthScreen, ErrorText, Field, LinkButton, PrimaryButton } from '@/components/auth-ui';
import { supabase } from '@/lib/supabase';
import { isValidEmail } from '@/lib/validation';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!isValidEmail(email)) return setError('Enter a valid email address.');
    setError(null);
    setBusy(true);
    const addr = email.trim();
    // Reject unknown emails before sending a code via the account_exists() RPC
    // (…_readd_account_exists.sql). NOTE: this is an email-enumeration oracle by design
    // (product decision). Auth CAPTCHA guards this UI, but the RPC is anon-callable and
    // outside auth rate limits — see the residual-risk note in supabase/config.toml.
    const { data: exists, error: existsErr } = await supabase.rpc('account_exists', { p_email: addr });
    if (existsErr) {
      setBusy(false);
      return setError('Something went wrong — try again.');
    }
    if (!exists) {
      setBusy(false);
      return setError('No account found for that email.');
    }
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(addr);
    setBusy(false);
    if (resetErr) {
      // The account exists (checked above), so a send failure is a real problem — don't
      // advance to the code screen where no code would ever arrive. (A Google-only account
      // is a no-op success here, not an error; the subtitle points those users to Google.)
      return setError(
        resetErr.status === 429
          ? 'Too many requests — wait a minute and try again.'
          : 'Couldn’t send the reset code — try again.'
      );
    }
    router.push({ pathname: '/reset-password', params: { email: addr } });
  }

  return (
    <AuthScreen
      title="Reset password"
      subtitle="Enter your account email and we’ll send a 6-digit reset code. Signed up with Google? Log in with Google instead.">
      <Field
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        icon="envelope"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <ErrorText>{error}</ErrorText>
      <PrimaryButton label="Send reset code" onPress={submit} loading={busy} />
      <LinkButton label="Back to login" onPress={() => router.back()} />
    </AuthScreen>
  );
}
