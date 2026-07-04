-- Restrict the private meal-photos bucket to JPEG uploads server-side (the client
-- only ever uploads compressed JPEG). Prevents a user from stashing arbitrary bytes
-- in their own folder. Bucket stays private with per-user folder RLS unchanged.
update storage.buckets
set allowed_mime_types = array['image/jpeg']
where id = 'meal-photos';
