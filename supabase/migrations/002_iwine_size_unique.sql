-- CT bruker samme iWine for flere flaskestørrelser av samme vin (verifisert:
-- 750ml + 1,5L deler iWine). Unik nøkkel må derfor være (iwine_id, size).
ALTER TABLE wines DROP CONSTRAINT IF EXISTS wines_iwine_id_key;
ALTER TABLE wines ADD CONSTRAINT wines_iwine_id_size_key UNIQUE (iwine_id, size);
