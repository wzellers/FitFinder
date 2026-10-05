-- Make clothing photos private. The app now loads them through short-lived
-- signed URLs, which the clothing_images_select_own policy already allows
-- for the owner. Apply this only after the app version that uses signed
-- URLs is deployed, or images will stop loading in the old version.
BEGIN;

UPDATE storage.buckets SET public = false WHERE id = 'clothing-images';

-- Store the object path instead of the (now unusable) public URL.
UPDATE public.clothing_items
SET image_url = substring(image_url FROM '/clothing-images/(.*)$')
WHERE image_url LIKE '%/storage/v1/object/public/clothing-images/%';

COMMIT;
