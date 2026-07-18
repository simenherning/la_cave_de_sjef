-- EAN/UPC fra CellarTrackers klassiske eksport (xlquery, kolonnen "UPC").
-- Community-data på vin-nivå — dekker ~75 % av kjelleren og lar tellingen
-- gjenkjenne flasker automatisk uten manuell EAN-læring.
ALTER TABLE wines ADD COLUMN IF NOT EXISTS upc TEXT;
