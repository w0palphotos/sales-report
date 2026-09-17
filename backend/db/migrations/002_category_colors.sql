CREATE TABLE IF NOT EXISTS category_colors (
  id         SERIAL PRIMARY KEY,
  field      TEXT        NOT NULL,
  value      TEXT        NOT NULL,
  bg         TEXT        NOT NULL,
  color      TEXT        NOT NULL DEFAULT '#2f3437',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (field, value)
);
