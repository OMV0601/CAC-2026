-- 0005: adding a person
--
-- why this is a function and not a normal insert:
-- "insert ... returning" has to pass the SELECT rule too, and you arent in
-- the circle yet at that moment, so the new row cant read itself back and
-- postgres throws "new row violates row-level security policy".
-- doing both inserts in one security definer function fixes that.

create or replace function create_person(p_name text, p_about text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_id uuid;
begin
  -- have to be signed in
  if auth.uid() is null then
    raise exception 'You need to be signed in to add a person'
      using hint = 'Sign in and try again.';
  end if;

  -- strangers who scanned a code are signed in anonymously.
  -- they should never be able to add people
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Guests with a code cannot add people'
      using hint = 'Sign in with an email account.';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Name is required';
  end if;

  -- make the person
  insert into people (name, about, created_by)
  values (trim(p_name), nullif(trim(coalesce(p_about, '')), ''), auth.uid())
  returning id into new_id;

  -- and make whoever added them the owner of their circle
  insert into circle_members (person_id, user_id, role)
  values (new_id, auth.uid(), 'owner');

  return new_id;
end;
$$;

-- only signed in users can call it
revoke execute on function create_person(text, text) from public, anon;
grant execute on function create_person(text, text) to authenticated;
