-- The profile-pictures bucket is unused by the app. The bucket itself is
-- emptied and deleted via the dashboard; this removes its leftover policies.
DROP POLICY IF EXISTS "Profile pictures are publicly viewable"     ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own profile picture" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile picture" ON storage.objects;
