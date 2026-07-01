create table if not exists private.sticky_note_post_limits (
  user_id uuid primary key,
  last_posted_at timestamptz not null
);

revoke all on private.sticky_note_post_limits
  from public, anon, authenticated;

create or replace function private.enforce_sticky_note_post_cooldown()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 0)
  );

  if exists (
    select 1
    from private.sticky_note_post_limits
    where user_id = new.user_id
      and last_posted_at > now() - interval '15 minutes'
  ) then
    raise exception 'sticky_note_rate_limit'
      using errcode = 'P0001';
  end if;

  insert into private.sticky_note_post_limits (user_id, last_posted_at)
  values (new.user_id, now())
  on conflict (user_id) do update
    set last_posted_at = excluded.last_posted_at;

  return new;
end;
$$;

drop trigger if exists enforce_sticky_note_post_cooldown
  on public.sticky_notes;

create trigger enforce_sticky_note_post_cooldown
before insert on public.sticky_notes
for each row execute function private.enforce_sticky_note_post_cooldown();
