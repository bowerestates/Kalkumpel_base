import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from './supabase';

export type NutritionResult = {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: 'low' | 'medium' | 'high';
  /** Detected ingredients/components shown in the review screen. */
  items: string[];
};

// Anthropic rejects images above ~5MB; guard well under that after compression.
const MAX_IMAGE_BYTES = 4_500_000;

/** Resize to a sane size and base64-encode as JPEG, kept under Anthropic's image-size cap. */
async function encodeImage(uri: string): Promise<string> {
  const image = await ImageManipulator.manipulate(uri).resize({ width: 1024 }).renderAsync();
  const result = await image.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });
  if (!result.base64) throw new Error('Failed to encode image.');
  // base64 inflates ~4/3; derive approximate decoded byte size.
  const approxBytes = Math.floor((result.base64.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    throw new Error('Photo is too large to analyze — try a closer or simpler shot.');
  }
  return result.base64;
}

/**
 * Analyze a meal photo via the `analyze-meal` Supabase Edge Function (which holds the
 * Anthropic key server-side, is JWT-gated, and enforces a per-user daily cap — the key
 * never ships in the client bundle). `functions.invoke` auto-attaches the user's session
 * JWT. The function returns Anthropic's raw response, which we parse here.
 *
 * Throws on missing session / network / API / cap / parse errors — the caller (Review
 * screen) catches and lets the user enter values manually.
 */
export async function analyzeMeal(uri: string): Promise<NutritionResult> {
  const base64 = await encodeImage(uri);

  // A non-2xx from the proxy (401 / 429 over-cap / Anthropic 4xx-5xx) surfaces as a
  // FunctionsHttpError in `error`, not as `data` — throw so Review falls back to manual entry.
  const { data, error } = await supabase.functions.invoke('analyze-meal', {
    body: { imageBase64: base64 },
  });
  if (error) throw error;

  const toolUse = (data?.content ?? []).find(
    (b: { type?: string; name?: string }) => b.type === 'tool_use' && b.name === 'log_nutrition'
  );
  if (!toolUse?.input) throw new Error('No nutrition data in model response.');

  const i = toolUse.input;
  return {
    name: String(i.name ?? 'Meal'),
    calories: Number(i.calories) || 0,
    protein: Number(i.protein_g) || 0,
    carbs: Number(i.carbs_g) || 0,
    fat: Number(i.fat_g) || 0,
    confidence: i.confidence === 'high' || i.confidence === 'low' ? i.confidence : 'medium',
    items: Array.isArray(i.items) ? i.items.map((s: unknown) => String(s)).filter(Boolean) : [],
  };
}
