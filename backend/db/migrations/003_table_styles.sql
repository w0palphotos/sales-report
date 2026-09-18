CREATE TABLE IF NOT EXISTS table_styles (
  id         SERIAL PRIMARY KEY,
  kind       TEXT        NOT NULL CHECK (kind IN ('row', 'column')),
  key        TEXT        NOT NULL,
  bg         TEXT        NOT NULL,
  color      TEXT        NOT NULL DEFAULT '#2f3437',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kind, key)
);
