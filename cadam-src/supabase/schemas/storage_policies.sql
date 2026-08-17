-- Images and Meshes
CREATE POLICY "Give users access to own folder images_select" ON storage.objects FOR SELECT TO public USING (bucket_id = 'images' AND (select auth.uid()::text) = (storage.foldername(name))[1]);

CREATE POLICY "Give users access to own folder images_insert" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'images' AND (select auth.uid()::text) = (storage.foldername(name))[1]);

CREATE POLICY "Give users access to own folder images_update" ON storage.objects FOR UPDATE TO public USING (bucket_id = 'images' AND (select auth.uid()::text) = (storage.foldername(name))[1]);

CREATE POLICY "Give users access to own folder images_delete" ON storage.objects FOR DELETE TO public USING (bucket_id = 'images' AND (select auth.uid()::text) = (storage.foldername(name))[1]);

CREATE POLICY "Give users access to own folder meshes_select" ON storage.objects FOR SELECT TO public USING (bucket_id = 'meshes' AND (select auth.uid()::text) = (storage.foldername(name))[1]);

CREATE POLICY "Give users access to own folder meshes_insert" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'meshes' AND (select auth.uid()::text) = (storage.foldername(name))[1]);

CREATE POLICY "Give users access to own folder meshes_update" ON storage.objects FOR UPDATE TO public USING (bucket_id = 'meshes' AND (select auth.uid()::text) = (storage.foldername(name))[1]);

CREATE POLICY "Give users access to own folder meshes_delete" ON storage.objects FOR DELETE TO public USING (bucket_id = 'meshes' AND (select auth.uid()::text) = (storage.foldername(name))[1]);

-- Shared Conversations
CREATE POLICY "Public conversations allow anyone to view images_select" ON storage.objects FOR SELECT TO anon, authenticated USING (((bucket_id = 'images'::text) AND (EXISTS ( SELECT 1 FROM conversations WHERE ((conversations.privacy = 'public') AND ((conversations.id)::text = (storage.foldername(objects.name))[2]))))));

CREATE POLICY "Public conversations allow anyone to view meshes_select" ON storage.objects FOR SELECT TO anon, authenticated USING (((bucket_id = 'meshes'::text) AND (EXISTS ( SELECT 1 FROM conversations WHERE ((conversations.privacy = 'public') AND ((conversations.id)::text = (storage.foldername(objects.name))[2]))))));

-- Previews
CREATE POLICY "Give users access to own folder previews_select" ON storage.objects FOR SELECT TO public USING (bucket_id = 'previews' AND (select auth.uid()::text) = (storage.foldername(name))[1]);

CREATE POLICY "Give users access to own folder previews_insert" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'previews' AND (select auth.uid()::text) = (storage.foldername(name))[1]);

CREATE POLICY "Give users access to own folder previews_update" ON storage.objects FOR UPDATE TO public USING (bucket_id = 'previews' AND (select auth.uid()::text) = (storage.foldername(name))[1]);

CREATE POLICY "Give users access to own folder previews_delete" ON storage.objects FOR DELETE TO public USING (bucket_id = 'previews' AND (select auth.uid()::text) = (storage.foldername(name))[1]);

-- Only allow service role to upload temp multiview images (from our functions)
CREATE POLICY "Allow service role to upload temp multiview images"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'temp-multiview');

-- Allow public read access (for Tripo to download)
CREATE POLICY "Allow public read access to temp multiview images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'temp-multiview');

-- Allow service role to delete expired files (for manual cleanup if needed)
CREATE POLICY "Allow service role to delete temp multiview images"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'temp-multiview');
