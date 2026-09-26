-- 0002: helper functions that the security rules use
-- they are "security definer" so they can read the tables without
-- getting blocked by row level security themselves.
-- every one pins search_path so nobody can trick it with their own objects

-- is the signed in user in this person's circle?
create or replace function is_circle_member(p_person uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from circle_members
    where person_id = p_person and user_id = auth.uid()
  );
$$;

-- is the signed in user an owner of this person's circle?
create or replace function is_circle_owner(p_person uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from circle_members
    where person_id = p_person and user_id = auth.uid() and role = 'owner'
  );
$$;

-- does the signed in (anonymous) user have a working code for this person?
-- we check the parent grant every time, so revoking a code kills
-- every session that came from it right away
create or replace function has_grant_for(p_person uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from grant_sessions gs
    join access_grants g on g.id = gs.grant_id
    where gs.person_id = p_person
      and gs.user_id = auth.uid()
      and g.revoked_at is null
      and g.expires_at > now()
  );
$$;

-- member OR stranger with a working code
create or replace function can_view_person(p_person uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select is_circle_member(p_person) or has_grant_for(p_person);
$$;

-- storage paths look like "<person_id>/file.webm"
-- this pulls out the person id, or gives null if it isnt a real uuid
-- (so a weird path just fails the check instead of crashing)
create or replace function path_person_id(p_path text)
returns uuid
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  first_part text;
begin
  first_part := split_part(p_path, '/', 1);
  if first_part ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return first_part::uuid;
  end if;
  return null;
end;
$$;

-- used by the /debug page to check the migrations ran.
-- it only says which tables exist, it never returns any data
create or replace function lexicon_health()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'tables', coalesce((
      select jsonb_agg(table_name order by table_name)
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('people', 'signals', 'circle_members', 'access_grants',
                           'grant_sessions', 'ask_requests', 'push_subscriptions', 'access_log')
    ), '[]'::jsonb),
    'bucket', exists (select 1 from storage.buckets where id = 'signals'),
    'bucket_public', coalesce((select public from storage.buckets where id = 'signals'), false)
  );
$$;

grant execute on function lexicon_health() to anon, authenticated;
