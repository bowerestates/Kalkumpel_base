import { getJSON, KEYS, setJSON } from './storage';
import { DEFAULT_PREFS, LegacyPrefs, Prefs, Reminder } from './types';

/**
 * Local scheduled notifications work in Expo Go (SDK 54). Only remote push was
 * removed in SDK 53+, which makes importing expo-notifications log a noisy
 * push-registration warning in Expo Go — that's suppressed via LogBox in
 * app/_layout.tsx. We import lazily so the warning only appears once a reminder
 * action actually runs, keeping the core snap→log loop quiet.
 */

let handlerSet = false;

/** Normalize any stored shape (old fixed `mealTimes`, new `reminders`, or partial). */
function normalizePrefs(raw: LegacyPrefs | null): Prefs {
  if (!raw) return DEFAULT_PREFS;
  let reminders: Reminder[];
  if (Array.isArray(raw.reminders)) {
    reminders = raw.reminders;
  } else if (raw.mealTimes) {
    // Migrate the legacy breakfast/lunch/dinner record → named reminders.
    reminders = Object.entries(raw.mealTimes).map(([key, t]) => ({
      id: key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      hour: t.hour,
      minute: t.minute,
    }));
  } else {
    reminders = DEFAULT_PREFS.reminders;
  }
  return {
    remindersEnabled: raw.remindersEnabled ?? false,
    reminders,
    scheduledNotificationIds: raw.scheduledNotificationIds ?? [],
  };
}

async function loadNotifications() {
  const Notifications = await import('expo-notifications');
  if (!handlerSet) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    handlerSet = true;
  }
  return Notifications;
}

export async function getPrefs(): Promise<Prefs> {
  return normalizePrefs(await getJSON<LegacyPrefs | null>(KEYS.prefs, null));
}

export async function ensurePermission(): Promise<boolean> {
  const Notifications = await loadNotifications();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/**
 * Reschedule every daily reminder from prefs. Cancels prior ones first, persists
 * the new IDs. Returns the updated prefs.
 */
export async function applyReminders(prefs: Prefs): Promise<Prefs> {
  const Notifications = await loadNotifications();

  await Promise.all(
    prefs.scheduledNotificationIds.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
    )
  );

  let ids: string[] = [];
  if (prefs.remindersEnabled) {
    const granted = await ensurePermission();
    if (granted) {
      ids = await Promise.all(
        prefs.reminders.map((r) =>
          Notifications.scheduleNotificationAsync({
            content: {
              title: 'Time to log a meal 🍽️',
              body: `Have you tracked your ${r.label}?`,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour: r.hour,
              minute: r.minute,
            },
          })
        )
      );
    }
  }

  const next: Prefs = { ...prefs, scheduledNotificationIds: ids };
  await setJSON(KEYS.prefs, next);
  return next;
}

/** Cancel every reminder we scheduled (used by Settings → reset, before clearing storage). */
export async function cancelAllReminders(): Promise<void> {
  const Notifications = await loadNotifications();
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

/** Fire-and-forget congrats when a streak milestone is reached. */
export async function congratulateStreak(current: number): Promise<void> {
  const Notifications = await loadNotifications();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🔥 ${current}-day streak!`,
      body: 'Nice work keeping your tracking going. Keep it up tomorrow!',
    },
    trigger: null, // immediate
  });
}
