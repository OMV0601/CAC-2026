-- 0006: QR codes for strangers (make, revoke, claim)
--
-- how a stranger gets in:
--   1. they open /c/<token>
--   2. the app signs them in ANONYMOUSLY (a real user id, but no email)
--   3. the app calls claim_grant(token), which checks the code and adds a
--      grant_sessions row linking that anonymous user to one person
--   4. from then on every rule checks that row, not the token

-- families should only make and revoke codes through the functions below,
-- so nobody can sneak in a code that never expires
drop policy if exists "grants: members can make codes" on access_grants;
drop policy if exists "grants: members can revoke codes" on access_grants;

-- make a code.
-- the lifetime gets CLAMPED (pulled into range) instead of throwing an error,
-- because a code that never expires is exactly what we're trying to prevent
create or replace function create_grant(p_person uuid, p_label text, p_minutes integer)
returns access_grants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  minutes integer;
  new_grant access_grants;
begin
  if not is_circle_member(p_person) then
    raise exception 'You are not in this person''s circle';
  end if;

  -- at least 15 minutes, at most 7 days
  minutes := coalesce(p_minutes, 60);
  if minutes < 15 then minutes := 15; end if;
  if minutes > 7 * 24 * 60 then minutes := 7 * 24 * 60; end if;

  insert into access_grants (person_id, label, expires_at, created_by)
  values (p_person, nullif(trim(coalesce(p_label, '')), ''), now() + make_interval(mins => minutes), auth.uid())
  returning * into new_grant;

  return new_grant;
end;
$$;

-- revoke a code. every stranger using it loses access right away,
-- because has_grant_for() checks revoked_at every single time
create or replace function revoke_grant(p_grant uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  the_person uuid;
begin
  select person_id into the_person from access_grants where id = p_grant;
  if the_person is null or not is_circle_member(the_person) then
    raise exception 'Code not found';
  end if;

  update access_grants set revoked_at = now()
  where id = p_grant and revoked_at is null;
end;
$$;

-- a stranger uses a code.
-- gives back {ok: true, person_id, ...} or {ok: false, reason: ...}
create or replace function claim_grant(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  g access_grants;
  the_name text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in'
      using hint = 'Turn on anonymous sign-ins in Supabase (Authentication -> Sign In / Providers).';
  end if;

  select * into g from access_grants where token = p_token;

  if g.id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if g.revoked_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'revoked');
  end if;
  if g.expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  -- link this user to the person (doing it twice is fine)
  insert into grant_sessions (grant_id, person_id, user_id)
  values (g.id, g.person_id, auth.uid())
  on conflict (grant_id, user_id) do nothing;

  -- write it down so the family can see who looked
  insert into access_log (person_id, grant_id, user_id, action, detail)
  values (g.person_id, g.id, auth.uid(), 'opened_code', g.label);

  select name into the_name from people where id = g.person_id;

  return jsonb_build_object(
    'ok', true,
    'person_id', g.person_id,
    'person_name', the_name,
    'label', g.label,
    'expires_at', g.expires_at
  );
end;
$$;

-- who can call what
revoke execute on function create_grant(uuid, text, integer) from public, anon;
revoke execute on function revoke_grant(uuid) from public, anon;
revoke execute on function claim_grant(text) from public, anon;
grant execute on function create_grant(uuid, text, integer) to authenticated;
grant execute on function revoke_grant(uuid) to authenticated;
grant execute on function claim_grant(text) to authenticated;
