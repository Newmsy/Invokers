interface ImportMetaEnv {
  /** Supabase project URL. Leave unset to build the site without accounts. */
  readonly PUBLIC_SUPABASE_URL?: string;
  /** Supabase anon (public) key. Safe in the browser; row-level security guards the data. */
  readonly PUBLIC_SUPABASE_ANON_KEY?: string;
  /** Comma-separated sign-in providers, e.g. "google,discord". */
  readonly PUBLIC_AUTH_PROVIDERS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
