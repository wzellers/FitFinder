-- Accept JPEG and WebP in addition to PNG. The app encodes photos as WebP
-- (much smaller than PNG) and keeps PNG for images with transparency.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']
WHERE id = 'clothing-images';
