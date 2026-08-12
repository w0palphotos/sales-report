CREATE TABLE IF NOT EXISTS salespeople (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS cities (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS sales (
  id             BIGSERIAL PRIMARY KEY,
  salesperson_id INTEGER       NOT NULL REFERENCES salespeople (id),
  city_id        INTEGER       NOT NULL REFERENCES cities (id),
  product_id     INTEGER       NOT NULL REFERENCES products (id),
  amount         NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_salesperson_id ON sales (salesperson_id);
CREATE INDEX IF NOT EXISTS idx_sales_city_id        ON sales (city_id);
CREATE INDEX IF NOT EXISTS idx_sales_product_id     ON sales (product_id);

CREATE TABLE IF NOT EXISTS saved_reports (
  id         SERIAL PRIMARY KEY,
  name       TEXT        NOT NULL,
  config     JSONB       NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
