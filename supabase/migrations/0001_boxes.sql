-- Saved boxes: one row per signed-in player, holding the same document the site saves in the browser.
-- Row-level security lets each player read and write only their own row.

create table if not exists public.boxes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  doc jsonb not null,
  -- Copy of doc.importedAt, so the site can compare versions without downloading the whole box.
  imported_at text not null,
  updated_at timestamptz not null default now(),
  -- A big box is well under 5 MB; this stops the table being used as free storage.
  constraint boxes_doc_size check (octet_length(doc::text) < 20000000)
);

alter table public.boxes enable row level security;

create policy "Players read their own box" on public.boxes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Players add their own box" on public.boxes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Players update their own box" on public.boxes
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Players delete their own box" on public.boxes
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.touch_boxes_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists boxes_updated_at on public.boxes;
create trigger boxes_updated_at before update on public.boxes
  for each row execute function public.touch_boxes_updated_at();

-- "Delete my account": removes the player's sign-in, and their box with it (on delete cascade).
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
