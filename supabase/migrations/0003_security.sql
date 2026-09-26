-- 0003: row level security (who can read/write what)
--
-- two kinds of readers:
--   circle members = family/caregivers who signed in normally
--   strangers      = nurse/aide who scanned a code. they get signed in
--                    anonymously and have a row in grant_sessions
-- both of those end up as the "authenticated" role.
-- the "anon" role (nobody signed in at all) gets NOTHING.

-- the most important line in this whole project:
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
-- and make sure tables we add later dont get anon access by accident
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- turn on RLS for every table
alter table people enable row level security;
alter table circle_members enable row level security;
alter table access_grants enable row level security;
alter table grant_sessions enable row level security;
alter table ask_requests enable row level security;
alter table signals enable row level security;
alter table push_subscriptions enable row level security;
alter table access_log enable row level security;

-- ---------- people ----------
-- no insert policy on purpose. adding a person also has to add you as
-- the owner in circle_members, so that happens in a function (phase 1)
create policy "people: members and code holders can read"
  on people for select to authenticated
  using (can_view_person(id));

create policy "people: owners can edit"
  on people for update to authenticated
  using (is_circle_owner(id))
  with check (is_circle_owner(id));

create policy "people: owners can delete"
  on people for delete to authenticated
  using (is_circle_owner(id));

-- ---------- circle_members ----------
create policy "circle: members can see the circle"
  on circle_members for select to authenticated
  using (is_circle_member(person_id));

create policy "circle: owners can add people"
  on circle_members for insert to authenticated
  with check (is_circle_owner(person_id));

create policy "circle: owners can change roles"
  on circle_members for update to authenticated
  using (is_circle_owner(person_id))
  with check (is_circle_owner(person_id));

create policy "circle: owners can remove people"
  on circle_members for delete to authenticated
  using (is_circle_owner(person_id));

-- ---------- access_grants (the QR codes) ----------
-- strangers never read this table. they only ever use a function
create policy "grants: members can see codes"
  on access_grants for select to authenticated
  using (is_circle_member(person_id));

create policy "grants: members can make codes"
  on access_grants for insert to authenticated
  with check (is_circle_member(person_id) and created_by = auth.uid());

create policy "grants: members can revoke codes"
  on access_grants for update to authenticated
  using (is_circle_member(person_id))
  with check (is_circle_member(person_id));

create policy "grants: owners can delete codes"
  on access_grants for delete to authenticated
  using (is_circle_owner(person_id));

-- ---------- grant_sessions ----------
-- no insert policy. only claim_grant() (phase 2) can make these
create policy "sessions: see your own or your person's"
  on grant_sessions for select to authenticated
  using (user_id = auth.uid() or is_circle_member(person_id));

create policy "sessions: members can kick a stranger out"
  on grant_sessions for delete to authenticated
  using (is_circle_member(person_id));

-- ---------- signals (the dictionary) ----------
create policy "signals: members and code holders can read"
  on signals for select to authenticated
  using (can_view_person(person_id));

create policy "signals: members can add"
  on signals for insert to authenticated
  with check (is_circle_member(person_id));

create policy "signals: members can edit"
  on signals for update to authenticated
  using (is_circle_member(person_id))
  with check (is_circle_member(person_id));

create policy "signals: members can delete"
  on signals for delete to authenticated
  using (is_circle_member(person_id));

-- ---------- ask_requests ----------
-- the stranger who asked can see their own ask (so the answer gets back to them)
-- but NOT other strangers' asks
create policy "asks: asker and members can read"
  on ask_requests for select to authenticated
  using (asker_user_id = auth.uid() or is_circle_member(person_id));

-- only someone holding a working code can ask, and it has to start as "open"
create policy "asks: code holders can ask"
  on ask_requests for insert to authenticated
  with check (
    asker_user_id = auth.uid()
    and has_grant_for(person_id)
    and status = 'open'
    and answer is null
    and answered_by is null
  );

-- only the family can answer
create policy "asks: members can answer"
  on ask_requests for update to authenticated
  using (is_circle_member(person_id))
  with check (is_circle_member(person_id));

-- ---------- push_subscriptions ----------
create policy "push: only your own"
  on push_subscriptions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- access_log ----------
-- no insert/update/delete policy AT ALL. only security definer functions
-- write here, so whoever holds the code cant fake or hide the log
create policy "log: members can read"
  on access_log for select to authenticated
  using (is_circle_member(person_id));
