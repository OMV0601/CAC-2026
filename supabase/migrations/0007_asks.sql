-- 0007: layer 3 (ASK) and side-by-side confirming
--
-- the round trip:
--   stranger films 5 seconds -> uploads to <person_id>/asks/ -> create_ask()
--   family sees it in their inbox -> answer_ask()
--   the answer shows up on the stranger's screen by itself (realtime)

-- asks and answers only go through the functions below, so we can check
-- everything properly (and stop spam)
drop policy if exists "asks: code holders can ask" on ask_requests;
drop policy if exists "asks: members can answer" on ask_requests;

-- stranger asks "what is this?"
create or replace function create_ask(p_person uuid, p_video_path text, p_mime text, p_note text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_id uuid;
  the_grant uuid;
  recent integer;
begin
  -- need a working code for this person
  select gs.grant_id into the_grant
  from grant_sessions gs
  join access_grants g on g.id = gs.grant_id
  where gs.person_id = p_person
    and gs.user_id = auth.uid()
    and g.revoked_at is null
    and g.expires_at > now()
  limit 1;

  if the_grant is null then
    raise exception 'Your code has run out or was turned off';
  end if;

  -- the video has to be in THIS person's asks folder, nowhere else
  if p_video_path is null or p_video_path not like p_person::text || '/asks/%' then
    raise exception 'Bad video path';
  end if;

  -- stop someone spamming the family's phone
  select count(*) into recent from ask_requests
  where asker_user_id = auth.uid() and created_at > now() - interval '10 minutes';
  if recent >= 5 then
    raise exception 'Too many questions in a row'
      using hint = 'Wait a few minutes before asking again.';
  end if;

  insert into ask_requests (person_id, grant_id, asker_user_id, video_path, mime_type, note)
  values (p_person, the_grant, auth.uid(), p_video_path, p_mime, left(nullif(trim(coalesce(p_note, '')), ''), 500))
  returning id into new_id;

  insert into access_log (person_id, grant_id, user_id, action, detail)
  values (p_person, the_grant, auth.uid(), 'asked', left(p_note, 200));

  return new_id;
end;
$$;

-- family answers. p_known = false is layer 4: "we don't recognise this one"
create or replace function answer_ask(p_ask uuid, p_answer text, p_known boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  the_person uuid;
begin
  select person_id into the_person from ask_requests where id = p_ask;
  if the_person is null or not is_circle_member(the_person) then
    raise exception 'Question not found';
  end if;

  if p_known and length(trim(coalesce(p_answer, ''))) = 0 then
    raise exception 'Write an answer first';
  end if;

  update ask_requests
  set status = case when p_known then 'answered' else 'unknown' end,
      answer = case when p_known then left(trim(p_answer), 1000) else nullif(left(trim(coalesce(p_answer, '')), 1000), '') end,
      answered_by = auth.uid(),
      answered_at = now()
  where id = p_ask;
end;
$$;

-- stranger compared their clip to the family's clip, side by side,
-- and decided if it matches. we just write down what THEY decided
create or replace function log_confirmation(p_signal uuid, p_matched boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s signals;
  the_grant uuid;
begin
  select * into s from signals where id = p_signal;
  if s.id is null or not can_view_person(s.person_id) then
    raise exception 'Signal not found';
  end if;

  select gs.grant_id into the_grant from grant_sessions gs
  where gs.person_id = s.person_id and gs.user_id = auth.uid()
  order by gs.created_at desc limit 1;

  insert into access_log (person_id, grant_id, user_id, action, detail)
  values (s.person_id, the_grant, auth.uid(),
          case when p_matched then 'confirmed_match' else 'not_a_match' end,
          s.title);
end;
$$;

revoke execute on function create_ask(uuid, text, text, text) from public, anon;
revoke execute on function answer_ask(uuid, text, boolean) from public, anon;
revoke execute on function log_confirmation(uuid, boolean) from public, anon;
grant execute on function create_ask(uuid, text, text, text) to authenticated;
grant execute on function answer_ask(uuid, text, boolean) to authenticated;
grant execute on function log_confirmation(uuid, boolean) to authenticated;

-- realtime: send ask changes to whoever is allowed to see them
-- (supabase checks the same RLS rules before sending anything)
alter publication supabase_realtime add table ask_requests;

-- storage limits: only video and jpg files, and nothing huge
update storage.buckets
set file_size_limit = 26214400, -- 25 MB
    allowed_mime_types = array['video/webm', 'video/mp4', 'image/jpeg']
where id = 'signals';
