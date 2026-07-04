// analyze-meal — server-side proxy for the Anthropic meal-nutrition call.
//
// Why this exists: the Anthropic API key must never ship in the client bundle, and
// the paid API must not be callable directly/unmetered. This function is JWT-gated
// (verify_jwt = true + getUser), builds the Anthropic request envelope server-side
// (so a caller can't tamper with model/max_tokens), injects the key from a secret,
// and enforces a per-user daily cap. It returns Anthropic's RAW response so the
// existing client parser (lib/nutrition-api.ts) keeps working unchanged.

import { createClient } from 'npm:@supabase/supabase-js@2';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-4-8';
const DAILY_CAP = 100; // meal analyses per user per UTC day

// Bearer-JWT auth (no cookies), so a wildcard origin is safe here. Tighten to a
// specific web origin if/when the app has a fixed production web domain.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TOOL = {
  name: 'log_nutrition',
  description: 'Return a nutrition estimate for the food shown in the image.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'confidence', 'items'],
    properties: {
      name: { type: 'string', description: 'Short name of the meal/dish.' },
      calories: { type: 'integer', description: 'Total estimated calories (kcal).' },
      protein_g: { type: 'integer' },
      carbs_g: { type: 'integer' },
      fat_g: { type: 'integer' },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      items: {
        type: 'array',
        description: 'Main visible ingredients/components of the meal (1-6 short names).',
        items: { type: 'string' },
      },
    },
  },
} as const;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return json({ error: 'Unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) return json({ error: 'Server misconfigured' }, 500);

  // Identify the caller from the JWT (platform already verified it via verify_jwt).
  const authClient = createClient(supabaseUrl, anonKey);
  const { data: userData, error: userErr } = await authClient.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401);
  const userId = userData.user.id;

  // Atomic per-user daily cap (service role, bypasses RLS).
  const admin = createClient(supabaseUrl, serviceKey);
  const { error: capErr } = await admin.rpc('bump_meal_analysis', {
    p_user: userId,
    p_cap: DAILY_CAP,
  });
  if (capErr) return json({ error: 'Daily analysis limit reached. Try again tomorrow.' }, 429);

  let imageBase64: unknown;
  try {
    ({ imageBase64 } = await req.json());
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (typeof imageBase64 !== 'string' || !imageBase64) {
    return json({ error: 'Missing imageBase64' }, 400);
  }
  // Server-side size cap (mirrors the client guard) so a direct caller can't bypass it with a
  // huge payload. base64 length ~ 4/3 of decoded bytes; ~4.5MB decoded ≈ 6MB of base64 chars.
  if (imageBase64.length > 6_500_000) {
    return json({ error: 'Image too large' }, 413);
  }

  // Envelope built here so the client can't tamper with cost-sensitive params.
  const anthropicRes = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'log_nutrition' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: 'Estimate the nutrition for this meal.' },
          ],
        },
      ],
    }),
  });

  // Pass Anthropic's raw JSON + status straight through; the client parses it.
  const bodyText = await anthropicRes.text();
  return new Response(bodyText, {
    status: anthropicRes.status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
});
