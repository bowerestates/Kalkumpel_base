import type { Session, User } from '@supabase/supabase-js';
import { createContext, use, useEffect, useRef, useState, type ReactNode } from 'react';

import { runMigrationIfNeeded } from './migrate-local';
import { queryClient } from './query';
import { supabase } from './supabase';

/**
 * Reactive auth session for the root gate — mirrors onboarding-state. Holds the
 * Supabase session in React state so signing in/out flips the `Stack.Protected`
 * guard live. Must wrap OnboardingProvider (onboarding is derived from the
 * authenticated user's cloud profile).
 *
 * `bootReady` additionally waits for the one-time local→cloud migration to finish,
 * so OnboardingProvider never reads the profile before migration has written it.
 */
type AuthState = { ready: boolean; bootReady: boolean; session: Session | null; user: User | null };

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [migratedFor, setMigratedFor] = useState<string | null>(null);
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      lastUserId.current = data.session?.user?.id ?? null;
      setReady(true);
    });

    // Keep callback sync-only (Supabase deadlocks if you await its client here).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      const newId = s?.user?.id ?? null;
      if (newId !== lastUserId.current) {
        // Sign-out or user switch: drop the previous user's cached rows so they
        // never leak into another account.
        queryClient.clear();
        lastUserId.current = newId;
      }
      setSession(s);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;

  // Deferred (outside the auth callback) one-time local→cloud migration. Gates
  // bootReady so onboarding reads the profile only after migration has run.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    runMigrationIfNeeded(user.id)
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setMigratedFor(user.id);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const bootReady = ready && (!user || migratedFor === user.id);

  return <AuthContext value={{ ready, bootReady, session, user }}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** True only for accounts created with email+password (an 'email' identity).
 *  Used to gate the change/forgot-password flows away from Google-only users. */
export function hasPasswordIdentity(user: User | null): boolean {
  return !!user?.identities?.some((i) => i.provider === 'email');
}
