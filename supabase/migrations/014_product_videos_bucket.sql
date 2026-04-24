-- Separate bucket for product videos with video MIME types allowed.
-- The product-images bucket is locked to image/* types so video uploads
-- get rejected with 400 at the bucket level.
insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values (
  'product-videos',
  'product-videos',
  true,
  ARRAY['video/mp4', 'video/webm', 'video/quicktime'],
  52428800  -- 50 MB
)
on conflict (id) do nothing;

create policy "Public read product-videos"
  on storage.objects for select
  using (bucket_id = 'product-videos');

create policy "Admin upload product-videos"
  on storage.objects for insert
  with check (bucket_id = 'product-videos' and is_admin());

create policy "Admin delete product-videos"
  on storage.objects for delete
  using (bucket_id = 'product-videos' and is_admin());
