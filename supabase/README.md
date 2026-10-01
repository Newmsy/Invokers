# Accounts (Supabase)

Sign-in and box sync are optional. The site builds and works without them; the "Sign in" button appears only when
the build has `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` (see `site/.env.example`).

What's stored: Supabase Auth keeps each player's email and display name from Google or Discord. The `boxes` table
keeps one row per player with their decoded box (the same JSON the site saves in the browser). Row-level security
lets a player read and write only their own row. `delete_my_account()` removes the sign-in and, by cascade, the box.

## One-time setup

1. **Supabase project.** Create a free project at supabase.com. In **SQL Editor**, run
   `supabase/migrations/0001_boxes.sql`.
2. **Google.** In Google Cloud Console, create a project, set up the **OAuth consent screen** (External, app name,
   support email), then **Credentials > Create credentials > OAuth client ID** (Web application). Add the
   authorized redirect URI shown in Supabase under **Authentication > Providers > Google** (it looks like
   `https://<project>.supabase.co/auth/v1/callback`). Paste the client ID and secret into that Supabase page and enable it.
3. **Discord.** In the Discord Developer Portal, create an application. Under **OAuth2**, add the same Supabase
   callback URL as a redirect. Paste the client ID and secret into **Authentication > Providers > Discord** and enable it.
4. **Site URLs.** In **Authentication > URL Configuration**, set the Site URL to the live site and add
   `http://localhost:4321/**` and `https://<live-site>/**` to Redirect URLs.
5. **Build settings.** From **Project Settings > API**, copy the project URL and the `anon` public key. Set them as
   `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` wherever the site is built: in `site/.env` locally, as
   GitHub Actions variables (Settings > Secrets and variables > Actions > Variables), and on the host later.
   Never use the `service_role` key in the site.

More providers (GitHub, Twitch, Apple, X) work the same way: enable them in Supabase and list them in
`PUBLIC_AUTH_PROVIDERS`, e.g. `google,discord,twitch`.
