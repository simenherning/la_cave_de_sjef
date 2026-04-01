-- Wine cellar schema

CREATE TABLE wines (
  id BIGSERIAL PRIMARY KEY,
  iwine_id TEXT UNIQUE,
  type TEXT,
  color TEXT,
  category TEXT,
  size TEXT DEFAULT '750ml',
  vintage INTEGER,
  name TEXT NOT NULL,
  locale TEXT,
  producer TEXT,
  varietal TEXT,
  master_varietal TEXT,
  designation TEXT,
  vineyard TEXT,
  country TEXT,
  region TEXT,
  sub_region TEXT,
  appellation TEXT,
  quantity INTEGER DEFAULT 0,
  pending INTEGER DEFAULT 0,
  purchase_price NUMERIC,
  estimated_value NUMERIC,
  currency TEXT DEFAULT 'NOK',
  begin_consume INTEGER,
  end_consume INTEGER,
  window_source TEXT,
  community_score NUMERIC,
  community_notes TEXT,
  personal_score NUMERIC,
  personal_notes TEXT,
  wa_score NUMERIC,
  iwc_score NUMERIC,
  ws_score NUMERIC,
  we_score NUMERIC,
  br_score NUMERIC,
  gv_score NUMERIC,
  lf_score NUMERIC,
  jg_score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tasting_notes (
  id BIGSERIAL PRIMARY KEY,
  wine_id BIGINT REFERENCES wines(id) ON DELETE CASCADE,
  date_tasted DATE NOT NULL DEFAULT CURRENT_DATE,
  score INTEGER CHECK (score BETWEEN 50 AND 100),
  notes TEXT,
  food_pairing TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cellar_targets (
  id BIGSERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  filter_key TEXT NOT NULL,
  filter_value TEXT NOT NULL,
  target_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wines_updated_at
  BEFORE UPDATE ON wines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
