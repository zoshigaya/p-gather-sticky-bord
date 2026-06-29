-- Pギャザ感想ボード 初期スキーマ
-- 実行前に CHANGE_THIS_PASSWORD を管理者用パスワードへ置換してください。

create extension if not exists pgcrypto;

create table if not exists public.sticky_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author text check (char_length(author) <= 30),
  text text not null default '' check (char_length(text) <= 500),
  color text not null check (color in ('red', 'yellow', 'blue')),
  x double precision not null check (x between 0 and 82),
  y double precision not null check (y between 0 and 76),
  emoji text check (char_length(emoji) <= 8),
  drawing_url text,
  likes integer not null default 0 check (likes >= 0),
  rotation double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sticky_note_has_content check (char_length(trim(text)) > 0 or drawing_url is not null)
);

create index if not exists sticky_notes_created_at_idx on public.sticky_notes(created_at);

create table if not exists public.sticky_note_likes (
  note_id uuid not null references public.sticky_notes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (note_id, user_id)
);

alter table public.sticky_notes enable row level security;
alter table public.sticky_note_likes enable row level security;

revoke all on public.sticky_notes from anon, authenticated;
revoke all on public.sticky_note_likes from anon, authenticated;
grant select on public.sticky_notes to anon, authenticated;
grant insert on public.sticky_notes to authenticated;
grant update (x, y, updated_at) on public.sticky_notes to authenticated;
grant select, insert on public.sticky_note_likes to authenticated;

drop policy if exists "Anyone can read sticky notes" on public.sticky_notes;
create policy "Anyone can read sticky notes"
  on public.sticky_notes for select
  to anon, authenticated
  using (true);

drop policy if exists "Anonymous users can create their own notes" on public.sticky_notes;
create policy "Anonymous users can create their own notes"
  on public.sticky_notes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can move their own notes" on public.sticky_notes;
create policy "Users can move their own notes"
  on public.sticky_notes for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own likes" on public.sticky_note_likes;
create policy "Users can read their own likes"
  on public.sticky_note_likes for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can add their own likes" on public.sticky_note_likes;
create policy "Users can add their own likes"
  on public.sticky_note_likes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create or replace function public.increment_sticky_note_likes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.sticky_notes
  set likes = likes + 1, updated_at = now()
  where id = new.note_id;
  return new;
end;
$$;

drop trigger if exists sticky_note_like_added on public.sticky_note_likes;
create trigger sticky_note_like_added
after insert on public.sticky_note_likes
for each row execute function public.increment_sticky_note_likes();

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.app_settings (
  key text primary key,
  value text not null
);

insert into private.app_settings(key, value)
values ('admin_password_hash', crypt('CHANGE_THIS_PASSWORD', gen_salt('bf')))
on conflict (key) do update set value = excluded.value;

create or replace function public.verify_board_admin(provided_password text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select provided_password <> 'CHANGE_THIS_PASSWORD'
    and exists (
      select 1 from private.app_settings
      where key = 'admin_password_hash'
        and value = crypt(provided_password, value)
    );
$$;

create or replace function public.admin_move_sticky_note(
  note_id uuid,
  new_x double precision,
  new_y double precision,
  provided_password text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.verify_board_admin(provided_password) then
    return false;
  end if;
  update public.sticky_notes
  set x = new_x, y = new_y, updated_at = now()
  where id = note_id;
  return found;
end;
$$;

create or replace function public.admin_delete_sticky_note(
  note_id uuid,
  provided_password text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.verify_board_admin(provided_password) then
    return false;
  end if;
  delete from public.sticky_notes where id = note_id;
  return found;
end;
$$;

revoke all on function public.verify_board_admin(text) from public;
revoke all on function public.admin_move_sticky_note(uuid, double precision, double precision, text) from public;
revoke all on function public.admin_delete_sticky_note(uuid, text) from public;
grant execute on function public.verify_board_admin(text) to authenticated;
grant execute on function public.admin_move_sticky_note(uuid, double precision, double precision, text) to authenticated;
grant execute on function public.admin_delete_sticky_note(uuid, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('drawings', 'drawings', true, 2097152, array['image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view drawings" on storage.objects;
create policy "Anyone can view drawings"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'drawings');

drop policy if exists "Users can upload drawings to their folder" on storage.objects;
create policy "Users can upload drawings to their folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'drawings'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sticky_notes'
  ) then
    alter publication supabase_realtime add table public.sticky_notes;
  end if;
end $$;
