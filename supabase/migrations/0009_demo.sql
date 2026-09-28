-- 0009: demo person, so anyone can try the stranger view
--
-- the demo person is made up (made by npm run seed:demo). the landing page
-- "Try the demo" button asks open_demo() for a fresh short code each time,
-- so there's no long-lived code sitting around

alter table people add column if not exists is_demo boolean not null default false;

-- same as create_person, but marks them as demo (made-up data)
create or replace function create_demo_person(p_name text, p_about text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Sign in with an email account first';
  end if;

  insert into people (name, about, created_by, is_demo)
  values (trim(p_name), nullif(trim(coalesce(p_about, '')), ''), auth.uid(), true)
  returning id into new_id;

  insert into circle_members (person_id, user_id, role)
  values (new_id, auth.uid(), 'owner');

  return new_id;
end;
$$;

-- "Try the demo" button: makes a 2 hour code for a DEMO person only.
-- real people can never be opened this way
create or replace function open_demo(p_person uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_token text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if not exists (select 1 from people where id = p_person and is_demo) then
    raise exception 'Demo not found';
  end if;

  -- stop a bot from making thousands of codes
  if (select count(*) from access_grants
      where person_id = p_person and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'The demo is busy, try again in a minute';
  end if;

  insert into access_grants (person_id, label, expires_at, created_by)
  values (p_person, 'Demo visitor', now() + interval '2 hours', null)
  returning token into new_token;

  return new_token;
end;
$$;

-- claim_grant again, now also says if it's a demo (so the page can show a banner)
create or replace function claim_grant(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  g access_grants;
  p people;
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

  insert into grant_sessions (grant_id, person_id, user_id)
  values (g.id, g.person_id, auth.uid())
  on conflict (grant_id, user_id) do nothing;

  insert into access_log (person_id, grant_id, user_id, action, detail)
  values (g.person_id, g.id, auth.uid(), 'opened_code', g.label);

  select * into p from people where id = g.person_id;

  return jsonb_build_object(
    'ok', true,
    'person_id', g.person_id,
    'person_name', p.name,
    'is_demo', p.is_demo,
    'label', g.label,
    'expires_at', g.expires_at
  );
end;
$$;

revoke execute on function create_demo_person(text, text) from public, anon;
revoke execute on function open_demo(uuid) from public, anon;
revoke execute on function claim_grant(text) from public, anon;
grant execute on function create_demo_person(text, text) to authenticated;
grant execute on function open_demo(uuid) to authenticated;
grant execute on function claim_grant(text) to authenticated;
