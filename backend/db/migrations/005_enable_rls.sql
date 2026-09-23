-- Row Level Security untuk seluruh tabel aplikasi.
--
-- Backend mengakses database lewat koneksi Postgres langsung dengan role pemilik
-- tabel (postgres, atau postgres.<ref> di Supabase) dan pemilik tabel tidak
-- terkena RLS — jadi aplikasi tetap berjalan tanpa policy.
--
-- Sementara itu role anon/authenticated (akses langsung PostgREST/Supabase API)
-- tidak punya policy apa pun, sehingga tabel-tabel ini tertutup untuk mereka.
ALTER TABLE salespeople     ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities          ENABLE ROW LEVEL SECURITY;
ALTER TABLE products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales           ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_reports   ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_styles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_catalog   ENABLE ROW LEVEL SECURITY;
