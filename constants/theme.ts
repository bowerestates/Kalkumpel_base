/**
 * MacroLens design tokens — Cal AI-inspired, light only.
 * Soft gray canvas, white cards with one soft shadow, near-black ink, black
 * primary actions, and small colored macro rings (red / orange / blue).
 */

import { Platform } from 'react-native';

/** The MacroLens palette. Light-only by design. */
export const C = {
  bg: '#F4F4F5', // app canvas
  card: '#FFFFFF', // surfaces
  ink: '#0E0E10', // primary text / black buttons
  sub: '#6B7280', // secondary text (≥4.5:1 on white/card)
  faint: '#9CA3AF', // tertiary text / placeholders
  hairline: '#ECECEE', // borders, ring tracks
  primary: '#0E0E10', // active tab / primary button bg
  streak: '#FF7A1A', // flame orange
  // Per-macro ring colors (Cal AI: calorie near-black, protein red, carbs orange, fat blue)
  calorie: '#1C1C1E',
  protein: '#FF4D4F',
  carbs: '#FF9F1C',
  fat: '#2E7CF6',
  danger: '#E5484D',
} as const;

/** Inter font families by weight (from @expo-google-fonts/inter). */
export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

/**
 * Nav theme shape kept for `ThemeProvider` and any `Colors[scheme]` call sites.
 * Both schemes resolve to the light palette — the app is light-only now.
 */
const light = {
  text: C.ink,
  background: C.bg,
  tint: C.primary,
  icon: C.sub,
  tabIconDefault: C.sub,
  tabIconSelected: C.primary,
};
export const Colors = { light, dark: light };

/** Brand/accent colors (kept for existing call sites; mapped to the new palette). */
export const Brand = {
  accent: C.streak,
  calories: C.calorie,
  protein: C.protein,
  carbs: C.carbs,
  fat: C.fat,
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

/** Shared card surface style (one soft shadow, 20px continuous radius). */
export const cardStyle = {
  backgroundColor: C.card,
  borderRadius: 20,
  borderCurve: 'continuous' as const,
  boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
};
