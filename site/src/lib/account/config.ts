// Accounts are optional: they switch on only when the build has a Supabase URL and anon key.
// Without them the site is browser-only, exactly as before.

export type Provider = 'google' | 'discord' | 'github' | 'twitch' | 'apple' | 'twitter';

export const PROVIDER_LABELS: Record<Provider, string> = {
  google: 'Google',
  discord: 'Discord',
  github: 'GitHub',
  twitch: 'Twitch',
  apple: 'Apple',
  twitter: 'X',
};

export const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL ?? '';
export const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? '';
export const accountsEnabled = !!supabaseUrl && !!supabaseAnonKey;

export function parseProviders(raw: string | undefined): Provider[] {
  const wanted = (raw || 'google,discord').split(',').map((p) => p.trim().toLowerCase());
  return wanted.filter((p): p is Provider => p in PROVIDER_LABELS);
}

export const providers = parseProviders(import.meta.env.PUBLIC_AUTH_PROVIDERS);
