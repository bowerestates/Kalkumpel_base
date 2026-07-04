import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from './auth-state';
import { getOnboardedFlag } from './entries';

/**
 * Reactive onboarding flag for the root gate. Derived from the authenticated
 * user's CLOUD profile (re-fetched whenever the user changes), so it must live
 * inside AuthProvider. Kept in React state so completing onboarding or resetting
 * data flips the `Stack.Protected` guard live.
 *
 * `ready` is DERIVED (not set in an effect) as "have we loaded THIS user's
 * profile yet". That matters: at the instant login flips `authed` true, an
 * effect-set `ready` would still be its stale `true` for one render — long enough
 * for the gate to mount the onboarding screen with a stale `onboarded=false`.
 * Deriving it makes `ready` false synchronously until the new profile loads.
 */
type OnboardingState = {
  ready: boolean;
  onboarded: boolean;
  setOnboarded: (v: boolean) => void;
};

const OnboardingContext = createContext<OnboardingState | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { bootReady, user } = useAuth();
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [onboarded, setOnboarded] = useState(false);

  useEffect(() => {
    if (!user) {
      setOnboarded(false);
      setLoadedFor(null); // so a re-login is treated as "not loaded yet"
      return;
    }
    if (!bootReady) return; // wait for migration before reading the profile
    const uid = user.id;
    let cancelled = false;

    // Retry through the transient post-login window (network / RLS / token
    // propagation) and a not-yet-visible profile row, instead of committing
    // onboarded=false — which would briefly mount the onboarding screen before the
    // real value arrives. handle_new_user creates the row at signup, so a null flag
    // means "not visible yet", not "new user".
    async function load(attempt: number) {
      let flag: boolean | null = null;
      try {
        flag = await getOnboardedFlag(); // boolean, or null when the row isn't visible yet
      } catch {
        flag = null; // transport/RLS error → treat as "not loaded", retry below
      }
      if (cancelled) return;
      if (flag !== null) {
        setOnboarded(flag);
        setLoadedFor(uid);
        return;
      }
      // ponytail: capped-backoff retry, up to 6 tries (~8s). The last attempt commits
      // onboarded=false so a genuinely broken / never-created profile can't hang on the
      // loading screen forever; the transient flash window is well under this ceiling.
      if (attempt >= 5) {
        setOnboarded(false);
        setLoadedFor(uid);
        return;
      }
      const delay = Math.min(300 * 2 ** attempt, 4800);
      setTimeout(() => {
        if (!cancelled) load(attempt + 1);
      }, delay);
    }
    load(0);

    return () => {
      cancelled = true;
    };
  }, [bootReady, user?.id]);

  // With a user, ready only once we've loaded THAT user's profile; without a
  // user, always ready (the auth gate takes over).
  const ready = user ? loadedFor === user.id : true;

  return <OnboardingContext value={{ ready, onboarded, setOnboarded }}>{children}</OnboardingContext>;
}

export function useOnboarding(): OnboardingState {
  const ctx = use(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
