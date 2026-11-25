// ============================================================
// Monolith 40k – site configuration
// Fill in the two values from Supabase → Project Settings → API.
// Leave them empty to run the site in DEMO mode (data stays in this browser).
// ============================================================
export const CONFIG = {
  SUPABASE_URL: 'https://xzovnbxwykzjibiqoueb.supabase.co',        // e.g. 'https://abcdefghijkl.supabase.co'
  SUPABASE_ANON_KEY: 'sb_publishable_4QBe7Vzb91bGRxKDgjI_KQ_48jiYKxE',   // the "anon public" key (safe to publish; permissions are enforced by the database)
  GOOGLE_LOGIN: false,     // set to true after enabling the Google provider in Supabase → Authentication → Providers
  TEAM_NAME: 'Monolith 40k',
  DEFAULT_LANG: 'de',      // 'de' or 'en'
};
