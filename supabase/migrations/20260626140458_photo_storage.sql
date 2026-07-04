-- Cross-device meal-photo sync: a private Storage bucket, one folder per user.
-- Photos live at meal-photos/<uid>/<rand>.jpg and are read via signed URLs.

insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

-- Per-user folder isolation. Paths are <uid>/<rand>.jpg and never rewritten, so no upsert and
-- no UPDATE policy is needed: SELECT (signed URLs), INSERT (upload), DELETE (removal).
-- (storage.foldername(name))[1] is the first path segment = <uid>.
create policy "meal_photos_select" on storage.objects for select to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "meal_photos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "meal_photos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
