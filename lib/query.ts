import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, QueryClient } from '@tanstack/react-query';

/** Single app-wide query client. Reads are cached + persisted so screens render
 *  instantly (incl. cold start / offline) and revalidate in the background. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

/** Persist the cache to AsyncStorage (non-secret derived rows; the auth session
 *  lives in encrypted SecureStore — see lib/supabase.ts). */
export const asyncStoragePersister = createAsyncStoragePersister({ storage: AsyncStorage });

// Pause queries offline, resume online (Expo skill pattern). NetInfo drives it.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(state.isConnected ?? true))
);

export const qk = {
  entries: ['entries'] as const,
  goals: ['goals'] as const,
  profile: ['profile'] as const,
  weights: ['weights'] as const,
};
