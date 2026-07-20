-- Innhentede smaksnotater og omtaler per vin, fra CellarTracker og andre
-- kilder på nettet. Fylles av research-agenter (Code/Cowork) via
-- /api/wines/[id]/external-notes eller Supabase REST. Brukes som grunnlag
-- for å anslå drikkevindu, forventet smak og mat-match.
CREATE TABLE external_notes (
  id BIGSERIAL PRIMARY KEY,
  wine_id BIGINT NOT NULL REFERENCES wines(id) ON DELETE CASCADE,
  source TEXT NOT NULL,          -- 'CellarTracker', 'Vivino', 'Jancis Robinson', 'Vinmonopolet' …
  source_url TEXT,
  author TEXT,                   -- anmelder/brukernavn hos kilden
  note_date DATE,                -- når notatet ble skrevet hos kilden
  score TEXT,                    -- heterogene skalaer ('93/100', '17/20', '4.2/5') → fritekst
  note TEXT,                     -- selve smaksnotatet/omtalen
  drink_from INTEGER,            -- kildens forslag til drikkevindu
  drink_to INTEGER,
  food_pairing TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX external_notes_wine_id_idx ON external_notes (wine_id);
