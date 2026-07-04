import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { dateKey } from './date';
import { sumTotals, Totals } from './entries';
import { useEntriesQuery, useGoalsQuery } from './queries';
import { qk, queryClient } from './query';
import { currentStreak, recomputeStreakFromKeys } from './streak';
import { DEFAULT_GOALS, Entry, Goals, Streak } from './types';

/**
 * Thin read hook over TanStack Query — same return shape as before, so call sites
 * stay unchanged. Cached entries/goals render instantly and revalidate on focus
 * (preserving the old "reload on focus" behavior). Streak is derived from the
 * entries array; no separate fetch. Writes still go through lib/entries.
 */
export function useEntries() {
  const entriesQ = useEntriesQuery();
  const goalsQ = useGoalsQuery();

  const reload = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: qk.entries });
    queryClient.invalidateQueries({ queryKey: qk.goals });
  }, []);

  useFocusEffect(reload);

  const entries: Entry[] = entriesQ.data ?? [];
  const goals: Goals = goalsQ.data ?? DEFAULT_GOALS;
  const loading = entriesQ.isLoading || goalsQ.isLoading;

  const streak: Streak = recomputeStreakFromKeys(entries.map((e) => e.dateKey));
  const today = dateKey();
  const todayEntries = entries.filter((e) => e.dateKey === today);
  const totals: Totals = sumTotals(todayEntries);
  const streakCount = currentStreak(streak, today);

  return { entries, todayEntries, totals, goals, streak, streakCount, loading, reload };
}
