# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> **Expo SDK 54.** Read the versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing native/Expo code — APIs changed across recent SDKs (notably the `expo-file-system` `File`/`Directory` API and `expo-notifications` losing remote push in 53+).

## Commands

```bash
npm start          # expo start (Metro; press i/a/w for ios/android/web)
npx expo start --tunnel   # REQUIRED to test Google OAuth in Expo Go (LAN-IP exp:// redirects are rejected — see lib/oauth.ts)
npm run ios        # expo start --ios
npm run android    # expo start --android
npm run web        # expo start --web (web output is "single" SPA — see app.json)
npm run lint       # expo lint (eslint-config-expo)
npx tsc --noEmit   # typecheck — strict mode is on, no dedicated script
npx tsx lib/streak.test.ts          # run a test (plain node:assert, no framework)
npx tsx lib/nutrition-plan.test.ts  # the other test

# Local Supabase (Docker). Ports are shifted +100 off the defaults to avoid clashes
# (API 54421, DB 54422, Studio 54423, Inbucket/mail 54424 — see supabase/config.toml).
supabase start                              # boot the local stack
supabase db reset                           # re-apply migrations from scratch
supabase migration new <name>               # author a new migration

# Deploy to the linked hosted project
supabase db push                            # apply new migrations to hosted
supabase functions deploy analyze-meal      # deploy the AI proxy Edge Function
supabase secrets set ANTHROPIC_API_KEY=...  # server-side key for analyze-meal (NEVER in .env/client)
supabase config push                        # push supabase/config.toml auth settings (verify in dashboard after)
```

There is **no test runner configured** — `package.json` has no `test` script and Jest isn't installed. The two tests, `lib/streak.test.ts` and `lib/nutrition-plan.test.ts`, are plain `node:assert` and run directly under `tsx` (above); treat them as the spec for the streak rules and the calorie/macro plan math.

### Environment (`.env` / `.env.local` at repo root, see `.env.example`)
Read at bundle time (`EXPO_PUBLIC_*`, so they ship in the client bundle — the anon key is meant to be public, protected by RLS):
- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` — **required**; `lib/supabase.ts` throws on boot without them.
- **Anthropic key is NOT a client env var.** The AI call is proxied by the `analyze-meal` Edge Function, which holds `ANTHROPIC_API_KEY` as a **server-side secret** (`supabase secrets set ANTHROPIC_API_KEY=…`). Never reintroduce an `EXPO_PUBLIC_ANTHROPIC_*` var — that ships the key in the bundle.

## Architecture

Expo Router (file-based routing) app. Camera → AI nutrition estimate → review/edit → log. **State is cloud-synced via Supabase** (Postgres + Auth + Storage, all RLS-protected per user); reads are cached/persisted with TanStack Query so screens render instantly (incl. offline) and revalidate in the background. Reminders and the session token stay device-local.

### Provider stack (`app/_layout.tsx`)
Order matters: `PersistQueryClientProvider` (the shared query cache, persisted to AsyncStorage) → `AuthProvider` → `OnboardingProvider` → `RootNavigator`. Onboarding is derived from the authenticated user's cloud profile, so it must nest inside auth. The splash is held until **auth + profile + fonts** are all ready, so the tabs never flash.

### The root gate — `RootNavigator` (three states)
`<Stack.Protected>` guards, flipped live by React state in the two providers:
1. **not authed** → `auth/` (login / sign-up / forgot-password).
2. **authed, not onboarded** → `onboarding` (also the fallback when app routes are gated out).
3. **authed + onboarded** → `(tabs)` + `camera` / `review` / `day` / `change-password`.

`onboarding` is registered under the authed guard (not the onboarded one) so Settings → Recalculate can still reach it. `reset-password` and `auth-callback` are always registered as deep-link targets (password-reset email; Google OAuth return).

### Routing (`app/`)
- `app/auth/` — `login`, `sign-up`, `forgot-password` (email/password + Google OAuth). `app/reset-password.tsx` and `app/change-password.tsx` handle the password flows.
- `app/auth-callback.tsx` — Google OAuth deep-link landing route. On **Android Expo Go** the `exp://…/--/auth-callback` redirect cold-reloads the app straight here (it isn't caught by `openAuthSessionAsync`); it turns the URL's `#access_token` fragment into a session via `exchangeFromUrl` and `router.replace('/')`s once the session lands. Web doesn't use it — there `redirectTo` is `/` and `detectSessionInUrl` consumes the token.
- `app/onboarding.tsx` — first-run flow: collects profile stats, computes a plan via `computePlan`, persists profile + goals to the cloud. Completing it flips `useOnboarding` live.
- `app/(tabs)/` — `index` (Today: calorie/macro cards + week strip + meal list), `progress` (body-weight line chart over 90D/6M/1Y/ALL with a "log weight" modal), `settings` (account management: change password, Google link, logout, account deletion, data reset). Account deletion cascades server-side (`delete_user` RPC + `deleteAllMealPhotos`) **and wipes local AsyncStorage** (`queryClient.clear()` + `AsyncStorage.clear()`) so a future sign-up starts genuinely fresh — otherwise `migrate-local` re-imports the old on-device profile and skips onboarding.
- `app/camera.tsx` — full-screen capture; on snap does `router.replace('/review', { uri })`.
- `app/review.tsx` — modal. New-meal mode runs `analyzeMeal(uri)` + uploads the photo; edit mode (`?id=`) prefills an existing entry and skips the AI call.
- `app/day.tsx` — drill-down for a single day (`?date=`): lists that day's meals, supports per-meal delete.

### Auth + sync layer (`lib/`)
- `lib/supabase.ts` — the singleton client. Imports `react-native-url-polyfill/auto` **first** (supabase-js needs it on RN). Session is stored in **`LargeSecureStore`**: a per-record AES key in `expo-secure-store` (Keychain/Keystore) encrypts the session ciphertext kept in AsyncStorage — the refresh token must never sit in plain storage, and this also dodges SecureStore's ~2KB Android limit. **Implicit** flow (`flowType: 'implicit'` — PKCE degrades in Expo Go without WebCrypto and GoTrue drops `redirect_to`, so Google OAuth returns `#access_token`, not `?code`); web falls back to plain AsyncStorage and `detectSessionInUrl`.
- `lib/auth-state.tsx` — `AuthProvider` + `useAuth()`. Holds the Supabase session in React state so sign-in/out flips the gate live. On user-switch it calls `queryClient.clear()` so one account's cached rows never leak into another. `bootReady` additionally waits for the one-time local→cloud migration. Also exports `hasPasswordIdentity(user)` — gates the change/forgot-password flows away from Google-only users.
- `lib/onboarding-state.tsx` — `OnboardingProvider` + `useOnboarding()`. Onboarded flag is **derived** from the cloud profile, and `ready` is derived synchronously (not effect-set) so the gate never mounts onboarding with a stale `onboarded=false` for one render after login.
- `lib/oauth.ts` — `signInWithGoogle()` + `exchangeFromUrl()` (turns an OAuth redirect URL into a session). Expo Go-compatible **implicit** flow (system browser via `expo-web-browser`, no native Google SDK). Web `redirectTo` is `/` (token consumed by `detectSessionInUrl`); native is `auth-callback`. **Expo Go must run with `--tunnel`**: GoTrue refuses any `redirect_to` whose host is a numeric IP (anti-open-redirect), so the default LAN-IP `exp://<ip>:8081/--/auth-callback` is silently dropped to `site_url`; the tunnel host (`*.exp.direct`) is alphanumeric and matches `exp://**`. (`calorietracker://**` works in dev/standalone builds without a tunnel.)
- `lib/migrate-local.ts` — one-time best-effort migration of the old AsyncStorage data into a signed-in user's cloud rows. Runs once per user (`migratedTo` flag) and **only into a genuinely fresh account** (not onboarded AND no entries AND no weights) so it never clobbers existing cloud data. Failures are swallowed.
- `lib/validation.ts` — shared email/password validation for the auth screens.
- `lib/storage.ts` — the legacy AsyncStorage KV store. **Now only read by `migrate-local.ts`** (the pre-auth data source); not the live data path anymore.

### Data layer (`lib/`) — the important boundary
- `lib/entries.ts` — **all CRUD goes through here. This is the DB boundary, now backed by Supabase** (per-user, RLS). UI and hooks keep calling the same functions; reads are cached by TanStack Query. Covers meals (`addEntry`/`updateEntry`/`removeEntry`), goals + profile (one row per user in `profiles`), `resetAllData`, and body weight (`getWeights`/`addWeight`/`latestWeight` — one row per user per day via upsert, kg). Maps snake_case rows ↔ camelCase types. `addEntry` clamps future dates to today *here* (the streak authority) and back-dates with a noon timestamp.
- `lib/query.ts` — the single `queryClient` (30s staleTime, persisted to AsyncStorage; auth session is NOT here, it's in SecureStore), NetInfo-driven online/offline pause, and the `qk` query-key registry.
- `lib/queries.ts` — cached read hooks for the hot path (`useEntriesQuery`, `useGoalsQuery`).
- `lib/useEntries.ts` — the Today read hook over TanStack Query. Same return shape as before; invalidates on `useFocusEffect` (preserving the old "reload on focus"). Derives today's totals + streak from the cached entries. **Writes never go through it.**
- `lib/streak.ts` — pure streak logic, unit-tested. **Invariant:** the streak has no stored row — it's recomputed from the user's logged dateKeys (`recomputeStreakFromKeys`) on every read and on either side of an `addEntry`. `currentStreak` treats a future `lastLoggedDate` as broken (hence the clamp in `addEntry`).
- `lib/nutrition-api.ts` — resizes/compresses the photo (rejects oversized images) then calls the **`analyze-meal` Edge Function** via `supabase.functions.invoke` (which auto-attaches the session JWT). The function (`supabase/functions/analyze-meal/index.ts`) holds the Anthropic key server-side, builds the Messages envelope + `log_nutrition` tool, and enforces a per-user daily cap; the client parses the returned raw Anthropic response. Throws on any failure so Review falls back to manual entry. **The Anthropic key never touches the client.**
- `lib/photo-storage.ts` — meal photos live in a **private Supabase Storage bucket** (`meal-photos`, one folder per user), so they sync across devices. `entries.photo_uri` stores the storage **path** (`<uid>/<rand>.jpg`); legacy rows keep a local `file://` URI, distinguished by `isRemotePath`. `uploadMealPhoto` compresses (best-effort — a failed photo must not block logging). `useSignedPhoto` resolves a path to a short-lived signed URL cached by React Query. Cleanup (`deleteMealPhoto` / `deleteAllMealPhotos`) is explicit because Storage isn't in the DB cascade.
- `lib/notifications.ts` — local meal reminders only (remote push gone in SDK 53+). `expo-notifications` is imported lazily. `applyReminders` cancels prior reminders before rescheduling and persists the returned IDs.
- `lib/nutrition-plan.ts` — pure, unit-tested math turning a `Profile` into a recommended calorie/macro `Plan` (Mifflin-St Jeor BMR, FAO/WHO activity multipliers, ISSN protein, IOM AMDR). Storage is always metric — convert imperial input first via the `lbToKg`/`inToCm` helpers here.
- `lib/date.ts` — local `YYYY-MM-DD` `dateKey`, the grouping unit for days and streaks.
- `lib/types.ts` — shared types + `DEFAULT_*` values.

### Database (`supabase/migrations/`)
- `..._init.sql` — `profiles` (1/user, demographics + goals + `onboarded`), `entries` (client-generated `text` id), `weights` (PK `user_id,date_key`). **RLS** scoped to `auth.uid()` on every table, plus explicit `grant`s (the Data API needs both). A `handle_new_user` trigger auto-creates the profiles row on signup. `delete_user()` (security-definer RPC) lets a client self-delete its account; `account_exists(email)` (security-definer RPC, granted to `anon`) backs forgot-password, which rejects unknown emails before sending a code. ⚠️ It is an **email-enumeration oracle** (product decision — re-added in `..._readd_account_exists.sql` after `..._drop_account_auth_status.sql` had removed the older `account_auth_status`). Mitigate with Auth CAPTCHA/rate-limiting; residual risk noted in `config.toml` since the RPC isn't behind auth rate limits.
- `..._photo_storage.sql` — the private `meal-photos` bucket + per-user folder-isolation policies (`(storage.foldername(name))[1] = auth.uid()`).
- `..._analysis_usage.sql` — `meal_analysis_usage` (PK `user_id,date_key`) + the `bump_meal_analysis(user, cap)` RPC that backs the `analyze-meal` per-user daily cap. **RLS on, no policies/grants** — only the service role reaches it; the Edge Function calls it once per request. The upsert atomically check-and-increments (raises `P0001` over the cap → 429), so parallel invocations can't race the count.
- `..._meal_photos_mime.sql` — restricts the `meal-photos` bucket to `image/jpeg` server-side (client only ever uploads compressed JPEG).
- `..._numeric_bounds.sql` — defense-in-depth `CHECK` bounds on all numeric columns (`entries` calories/macros, `profiles` demographics + goals, `weights` kg). Added `NOT VALID` so the push never trips on legacy rows while still enforcing on new writes.

### Components (`components/`)
Most are stock Expo-template helpers (`themed-*`, `parallax-scroll-view`, `ui/icon-symbol`, `haptic-tab`, `hello-wave`). The ones carrying real app logic:
- `components/ring-stat.tsx` — `ProgressRing`: one SVG circular progress ring (Reanimated, 700ms). The shared primitive under the calorie and macro cards.
- `components/nutrition-rings.tsx` — the Cal AI card layout (`CalorieCard` + macro cards). `pulseKey` pops the calorie ring when the goal is hit.
- `components/meal-row.tsx` / `components/meal-card.tsx` — logged-meal list-items (thumbnail via `useSignedPhoto` + macros). `meal-row` is the compact row (day drill-down); `meal-card` is the Today card. Both tap into `/review?id=` (edit) and support delete.
- `components/week-strip.tsx` — Sun–Sat strip for the current week on Today.
- `components/weight-chart.tsx` — SVG body-weight line chart; parent passes range-filtered points plus the `[domainStart, domainEnd]` window.
- `components/auth-ui.tsx` — shared inputs/buttons for the auth screens.
- `components/app-logo.tsx` — the MacroLens wordmark.
- `components/celebration-overlay.tsx` — goal/streak "win" badge. Parent owns a **FIFO queue** so stacked wins play one at a time.

### Conventions
- Import alias `@/*` maps to the **repo root** (e.g. `@/lib/entries`, `@/components/ui/icon-symbol`).
- Design system is `constants/theme.ts`: Cal AI-inspired, **light-only** (both `Colors` schemes resolve to light). Use the `C` palette, the `font` (Inter) families, and `cardStyle` — don't hardcode colors or re-derive card shadows.
- TypeScript `strict`; React Compiler and typed routes are enabled (`app.json` experiments) — don't fight the compiler with manual memoization unless measured.
- **Web** is built as a single-page app (`web.output: "single"` in `app.json`) — needed because AsyncStorage isn't SSR-safe.
- All cloud reads/writes go through `lib/entries.ts`; never call `supabase.from(...)` from a screen. The auth callback in `lib/auth-state.tsx` must stay **sync-only** (Supabase deadlocks if you `await` its client inside `onAuthStateChange`).
- Orientation is per-screen: content screens lock to `portrait_up`; `camera.tsx` uses `'all'` (full sensor) and repositions the shutter via `useShutterEdge()`. `react-native-screens` reasserts the lock on every navigation. Samsung One UI needs full sensor mode for a 180° flip — `SENSOR_PORTRAIT` blocks reverse-portrait.
