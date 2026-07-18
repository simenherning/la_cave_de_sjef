-- EAN-koblinger appen lærer under telling (ukjent EAN → bruker velger vin).
-- Egen tabell fordi wines-tabellen overskrives ved hver CT-import — lærte
-- koblinger skal overleve importer og gjenbrukes år etter år.
CREATE TABLE learned_eans (
  id BIGSERIAL PRIMARY KEY,
  ean TEXT NOT NULL,
  iwine_id TEXT NOT NULL,
  size TEXT NOT NULL DEFAULT '',
  wine TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (ean, iwine_id, size)
);
