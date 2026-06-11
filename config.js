// ─────────────────────────────────────────────────────────────
// RCNK Tracker — fill in the 3 values marked TODO, then save.
// Everything here is safe to be public (it ships to the browser).
// The SECRET keys live in Vercel, not here. See README.
// ─────────────────────────────────────────────────────────────
window.RCNK_CONFIG = {
  // TODO 1 — from Supabase → Project Settings → Data API
  SUPABASE_URL: "https://ixpgqnkfkpmsbuhpmrkt.supabase.co",

  // TODO 2 — from Supabase → Project Settings → API Keys → "anon public"
  SUPABASE_ANON_KEY: "sb_publishable_g_Lv4Klru0e5VemAfuUCuA_WPFa2BFL",

  // TODO 3 — the one password you both type to get in. Change this.
  SHARED_PASSWORD: "nolimits",

  // Already set for you — leave as is.
  VAPID_PUBLIC_KEY: "BKHYgVn4xySqyzdUABRydF6neASTeCUhIOsB1TN6tPdcvi2dpLTt2OP3rejXOh9DjOko2HU4qllM5eDf5yUoGUQ",
};
