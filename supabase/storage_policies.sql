-- ============================================================================
-- STORAGE — support ticket attachments
--
-- MANUAL STEP FIRST (can't be done via SQL): in the Supabase dashboard, go
-- to Storage → Create a new bucket named exactly "attachments", and mark it
-- PUBLIC (screenshots need to be viewable via a plain URL in the ticket
-- thread). Then run this file to set the upload policy.
-- ============================================================================

create policy "authenticated users can upload attachments"
on storage.objects for insert
to authenticated
with check (bucket_id = 'attachments');

create policy "anyone can view attachments"
on storage.objects for select
to public
using (bucket_id = 'attachments');

create policy "users can delete their own attachments"
on storage.objects for delete
to authenticated
using (bucket_id = 'attachments' and owner = auth.uid());
