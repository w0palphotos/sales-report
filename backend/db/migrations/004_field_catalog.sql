-- Katalog field laporan: memetakan kolom tabel sumber ke key & label yang dipakai
-- konfigurasi laporan. Backend tidak lagi memuat daftar field, jadi dataset lain
-- cukup mengisi tabel ini (label) sementara strukturnya dibaca dari information_schema.
CREATE TABLE IF NOT EXISTS field_catalog (
  source_column    TEXT        PRIMARY KEY,
  field_key        TEXT        NOT NULL,
  label            TEXT        NOT NULL,
  reference_column TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- reference_column = kolom yang dibaca dari tabel relasi (untuk dimensi hasil JOIN).
INSERT INTO field_catalog (source_column, field_key, label, reference_column) VALUES
  ('salesperson_id', 'sales_name', 'Nama Sales', 'name'),
  ('city_id',        'city',       'Kota',       'name'),
  ('product_id',     'product',    'Produk',     'name'),
  ('amount',         'amount',     'Penjualan',  NULL)
ON CONFLICT (source_column) DO UPDATE SET
  field_key        = EXCLUDED.field_key,
  label            = EXCLUDED.label,
  reference_column = EXCLUDED.reference_column;
