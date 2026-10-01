-- Share links: a snapshot of part of a player's box, or a team, that anyone with the link can open.
-- Players create, list and delete only their own. There is no public select policy, so nobody can list
-- other people's shares; get_share() opens exactly one share by its unguessable id.

create table if not exists public.shares (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{12}$'),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('box', 'team')),
  title text not null check (char_length(title) between 1 and 80),
  payload jsonb not null check (octet_length(payload::text) < 5000000),
  created_at timestamptz not null default now()
);

create index if not exists shares_user_id on public.shares (user_id, created_at desc);

alter table public.shares enable row level security;

create policy "Players see their own shares" on public.shares
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Players add their own shares" on public.shares
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    -- Keep it to a sensible number of links per player.
    and (select count(*) from public.shares s where s.user_id = (select auth.uid())) < 100
  );
create policy "Players delete their own shares" on public.shares
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Opens one share by id for anyone, signed in or not. Returns nothing about who made it.
create or replace function public.get_share(share_id text)
returns table (kind text, title text, payload jsonb, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.kind, s.title, s.payload, s.created_at from public.shares s where s.id = share_id;
$$;

revoke all on function public.get_share(text) from public;
grant execute on function public.get_share(text) to anon, authenticated;
