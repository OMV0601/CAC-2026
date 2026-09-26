-- 0004: storage rules for the "signals" bucket
--
-- IMPORTANT: storage has its OWN security, table rules dont cover it.
-- make the bucket first: Storage -> New bucket -> "signals" -> Public OFF
--
-- file paths:
--   <person_id>/<file>        = the family's clips (and poster images)
--   <person_id>/asks/<file>   = clips a stranger filmed for an ask

-- read files
-- members can read everything for their person.
-- code holders can read the family's clips but NOT the asks folder,
-- because thats video a different stranger filmed of the patient
create policy "signals bucket: read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'signals'
    and (
      is_circle_member(path_person_id(name))
      or (
        has_grant_for(path_person_id(name))
        and (storage.foldername(name))[2] is distinct from 'asks'
      )
    )
  );

-- upload files
-- members can upload anywhere under their person.
-- code holders can ONLY upload into the asks folder
create policy "signals bucket: upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'signals'
    and (
      is_circle_member(path_person_id(name))
      or (
        has_grant_for(path_person_id(name))
        and (storage.foldername(name))[2] = 'asks'
      )
    )
  );

-- only members can change or delete files
create policy "signals bucket: update"
  on storage.objects for update to authenticated
  using (bucket_id = 'signals' and is_circle_member(path_person_id(name)))
  with check (bucket_id = 'signals' and is_circle_member(path_person_id(name)));

create policy "signals bucket: delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'signals' and is_circle_member(path_person_id(name)));
