-- Merge "Hoodie" clothing type into "Sweatshirt" (now in Outerwear section)
UPDATE clothing_items SET type = 'Sweatshirt' WHERE type = 'Hoodie';
