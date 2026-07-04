import { useQuery } from '@tanstack/react-query';

import { getEntries, getGoals } from './entries';
import { qk } from './query';

/** Cached read hooks for the hot path (Today screen). Other screens read directly
 *  through lib/entries and refetch on focus. */
export const useEntriesQuery = () => useQuery({ queryKey: qk.entries, queryFn: getEntries });
export const useGoalsQuery = () => useQuery({ queryKey: qk.goals, queryFn: getGoals });
