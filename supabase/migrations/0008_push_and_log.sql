-- 0008: push notifications + small extras for phase 4

-- remember if we already buzzed the family about an ask,
-- so nobody can spam their phones by triggering it over and over
alter table ask_requests add column if not exists notified_at timestamptz;

-- save where this browser can get push notifications.
-- a function (not a normal insert) because the same browser might have been
-- used by a different account before, and we want to take the row over
create or replace function save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Only family accounts can turn on alerts';
  end if;
  if p_endpoint is null or p_endpoint not like 'https://%' then
    raise exception 'Bad push address';
  end if;

  delete from push_subscriptions where endpoint = p_endpoint;
  insert into push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth);
end;
$$;

revoke execute on function save_push_subscription(text, text, text) from public, anon;
grant execute on function save_push_subscription(text, text, text) to authenticated;
