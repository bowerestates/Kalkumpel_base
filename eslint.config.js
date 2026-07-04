// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // dist = build output; supabase/functions = Deno runtime (npm: imports, Deno global)
    // that the app's Node/Expo eslint can't resolve — it's typechecked by Deno, not here.
    ignores: ['dist/*', 'supabase/functions/**'],
  },
]);
