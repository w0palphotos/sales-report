# Dynamic Sales Insight & Report Builder

Aplikasi untuk membuat laporan penjualan **secara dinamis** tanpa menulis query atau membuat halaman baru untuk setiap jenis laporan. Pengguna menyusun laporannya sendiri lewat kombinasi **Baris + Kolom + Nilai + Perhitungan + Filter**, dan aplikasi merender tabel yang kolomnya berubah-ubah sesuai data.

Dibangun untuk technical interview assignment:

- **Backend**: Node.js + Express + PostgreSQL (`pg`, tanpa ORM)
- **Frontend**: Vue 3 + Vite + Chart.js
- **Test**: `node:test` bawaan Node (tanpa framework tambahan) + integration test menggunakan PostgreSQL embedded (`@electric-sql/pglite`)
- **Deploy**: satu proyek Vercel (API serverless `api/` + frontend statik, same-origin) dengan database Supabase

---

## Fitur

| Fitur | Keterangan |
|---|---|
| Baris | 1–3 field dimensi sebagai pengelompokan utama |
| Kolom | 0–1 field dimensi ditampilkan horizontal (dibentuk dari data) |
| Nilai | 1–8 measure dengan perhitungan `sum` (Total), `avg` (Rata-rata), `min` (Minimum), `max` (Maksimum), atau `count` (Jumlah Transaksi) |
| Filter | Banyak filter sekaligus; operator `=`, `!=`, `>`, `<`, `>=`, `<=`, `contains`, `between` |
| Tabel dinamis | Header berlapis, kolom + baris total, spreadsheet-like grid dengan sorting & filtering (Handsontable) |
| Sorting | Klik header kolom (asc / desc / none) |
| Grafik | Bar chart dari hasil laporan (Chart.js) |
| Export XLSX | Unduh hasil laporan sebagai file Excel (.xlsx) dalam satu sheet "Laporan Penjualan": tabel pivot dengan grafik chart native tepat di bawahnya, dan grafik otomatis ter-update saat data diedit |
| Laporan tersimpan | Simpan / muat / hapus konfigurasi laporan dengan nama |
| Input Data | UI untuk entry manual atau bulk upload via file (.csv, .xlsx) |
| Warna tabel | Isian warna per sel, baris, atau kolom lewat menu klik kanan, preset warna tabel bawaan maupun kustom, dan reset warna |

Semua kombinasi laporan ditangani oleh **satu mekanisme query** — tidak ada query yang ditulis khusus per laporan.

---

## Arsitektur

```
Browser (Vue SPA, same-origin /api)
  │
  ├─ POST /api/reports  { rows, columns, values, filters }
  │
  ▼
[ Validasi whitelist ] → [ Dynamic SQL Builder ] → [ GROUPING SETS query ] → [ Pivot → JSON ]
                                                         │
                                                         ▼
                                                  PostgreSQL (Supabase)
```

Struktur repo:

```
.
├── api/index.js                # Entry Vercel: mengekspor aplikasi Express yang sama
├── vercel.json                 # Build FE + rewrite SPA (tidak menimpa /api/*)
├── backend/
│   ├── src/
│   │   ├── app.js, server.js
│   │   ├── config/db.js                    # pg Pool (ramah serverless: max 5)
│   │   ├── core/ReportSchema.js            # sumber field/perhitungan/operator + introspeksi schema database
│   │   ├── core/QueryBuilder.js            # validasi + pembuat SQL dinamis (murni)
│   │   ├── core/PivotEngine.js             # ubah hasil panjang → format lebar (murni)
│   │   ├── core/CsvFormatter.js            # generate CSV (murni)
│   │   ├── services/reportService.js       # orkestrasi + akses data
│   │   ├── controllers/reportController.js # handler tipis + validasi ID
│   │   └── routes/index.js, middleware/errorHandler.js
│   ├── db/migrations/*.sql                 # skema: sales, saved_reports, category_colors, table_styles
│   ├── db/seed.js                          # seeder data awal (7 transaksi)
│   ├── scripts/migrate.js                  # menjalankan file migrasi SQL
│   └── test/                               # unit + integration test
├── frontend/
│   ├── src/styles/tokens.css, base.css     # design tokens monokrom hangat
│   ├── src/components/                     # ReportBuilder, PivotToolbar, DropdownSelect, FilterBuilder,
│   │                                       # ValueBuilder, AggregationSelect, ReportTable,
│   │                                       # CellColorPopover, BarChart, SavedReports
│   ├── src/composables/useReportBuilder.js
│   └── src/directives/reveal.js            # animasi masuk via IntersectionObserver
└── docker-compose.yml                      # opsional: PostgreSQL lokal
```

**Dependency runtime**: backend hanya `express` dan `pg`. Frontend hanya `vue`, `vite`, `chart.js`, `vue-chartjs`, `exceljs`, `jszip`, `handsontable`, `@handsontable/vue3`. Semua logika inti (validasi, SQL, pivot, CSV/XLSX) adalah fungsi murni yang mudah diuji.

---

## Desain Database

Untuk detail lengkap mengenai relasi antar tabel beserta tipe datanya, silakan lihat **[Diagram Entity-Relationship (ERD)](docs/ER-Diagram.md)**.

Skema _star schema_ sederhana:

```
salespeople(id, name UNIQUE)
cities(id, name UNIQUE)
products(id, name UNIQUE)

sales(id, salesperson_id FK, city_id FK, product_id FK, amount NUMERIC CHECK >= 0, created_at)

saved_reports(id, name, config JSONB, created_at)

category_colors(id, field, value, bg, color, UNIQUE(field, value))
table_styles(id, kind, key, bg, color, UNIQUE(kind, key))
```

- **Fact table** `sales` menyimpan satu transaksi; **tabel dimensi** `salespeople`, `cities`, `products` menyimpan nilai master.
- **Alasan**: nilai dimensi konsisten (tidak ada "Honda" vs "HONDA"), sehingga pengelompokan dan header kolom tetap rapi; duplikasi diminimalkan; menambah dimensi baru (tanggal, cabang, kategori) cukup tambah tabel + kolom FK tanpa merombak mesin query.
- **Index**: FK pada `sales` di-index untuk mempercepat join dan agregasi.
- **Aturan warna**: `category_colors` menyimpan warna per kategori dimensi yang berlaku global; `table_styles` menyimpan warna posisional baris dan kolom. Warna header kolom dan warna satu sel bersifat spesifik laporan, jadi disimpan di `saved_reports.config`, bukan di tabel terpisah.
- **Pengembangan data besar**: partition oleh `created_at`, atau pre-agregasi (materialized views) — lihat bagian "Skala besar".

---

## Cara Kerja Query Dinamis

1. Frontend mengirim konfigurasi abstrak (bukan SQL):

```json
{
  "rows": ["sales_name"],
  "columns": ["city"],
  "values": [{ "field": "amount", "aggregation": "sum" }],
  "filters": []
}
```

2. `QueryBuilder` memvalidasi seluruh input terhadap **whitelist**: field baris/kolom harus dimensi, field nilai harus measure, aggregation dan operator harus dikenal, dan operator dicek sesuai tipe field (teks vs angka).
3. SQL dibentuk dengan `GROUP BY GROUPING SETS`:

```sql
SELECT salespeople.name AS "_r0", cities.name AS "_c", SUM(s.amount) AS "_v0"
FROM sales s
JOIN salespeople ON s.salesperson_id = salespeople.id
JOIN cities ON s.city_id = cities.id
GROUP BY GROUPING SETS ((salespeople.name, cities.name), (salespeople.name), (cities.name), ())
ORDER BY "_r0" ASC, "_c" ASC
```

   Satu query menghasilkan sekaligus: data sel, total per baris, total per kolom, dan grand total. Total `avg` dihitung dari data mentah oleh PostgreSQL, sehingga nilai totalnya benar (bukan rata-rata dari rata-rata).
4. `pivot` mengubah hasil "panjang" menjadi format lebar siap-render; kombinasi tanpa data diisi `0`.

### Keamanan query dinamis

- Tidak ada satu pun string dari pengguna yang masuk ke SQL secara langsung. Nama kolom selalu berasal dari whitelist internal; nilai filter selalu lewat **parameterized query** (`$1`, `$2`, …).
- `ORDER BY` hanya memakai alias internal hasil query.
- SQL injection tidak mungkin terjadi: input hanya bisa memilih dari kumpulan field/operator yang sudah didefinisikan kode.

---

## Menjalankan di Lokal

### Prasyarat

- Node.js ≥ 20
- PostgreSQL (atau gunakan Supabase project gratis). Bila tidak ingin memasang PostgreSQL lokal, cukup isi `DATABASE_URL` dengan URL Supabase.

### Instalasi

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Konfigurasi Environment Variables (.env)

**1. Backend (`backend/.env`)**
- `DATABASE_URL`: (Wajib) URL koneksi ke PostgreSQL.
  - *Lokal (Docker/Native):* `postgresql://postgres:postgres@localhost:5432/sales_report`
  - *Supabase:* Gunakan URL mode *transaction pooler* (berjalan di port `6543`).
- `PORT`: (Opsional) Port backend untuk mode development, *default* `3000`.

**2. Frontend (`frontend/.env`)**
- `VITE_API_URL`: (Opsional) URL *base* untuk pemanggilan API. Secara *default*, Vite dikonfigurasi untuk mem-proxy rute `/api` secara same-origin. Anda **hanya perlu mengisi** variabel ini jika frontend dan backend dijalankan di *domain/origin* yang berbeda secara terpisah (misalnya `https://api.namadomain.com/api`).

### Siapkan database

```bash
# a) Supabase: buat project → ambil connection string transaction pooler (port 6543) → masukkan ke backend/.env
npm run db:migrate   # terapkan schema
npm run db:seed      # isi 7 transaksi awal (idempotent: truncate lalu insert)

# b) Atau PostgreSQL lokal via Docker:
docker compose up -d db
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sales_report npm run db:migrate
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sales_report npm run db:seed
```

> **Catatan:** `db:seed` hanya mengisi 7 transaksi contoh bawaan. Untuk dataset awal yang lebih lengkap, gunakan `data_awal.csv` dari **release v0.1** (lihat cara import di bawah).

### Menambahkan data awal dari release (data_awal.csv)

Dataset awal penjualan disediakan sebagai asset pada **GitHub Release v0.1**:
https://github.com/w0palphotos/sales-report/releases/tag/v0.1

Ada dua cara memuatnya ke database lokal:

**Cara 1 — Via UI (direkomendasikan):**
1. Unduh asset `data_awal.csv` dari halaman release di atas ke mesin Anda.
2. Jalankan aplikasi (`npm run dev:backend` + `npm run dev:frontend`).
3. Buka frontend → tab **Upload Batch (.csv / .xlsx)** → pilih file `data_awal.csv`.
4. Klik simpan — data akan dikirim ke `POST /api/sales/bulk` dan tersimpan ke database.

**Cara 2 — Via API langsung (`curl`):**
```bash
curl -X POST http://localhost:3000/api/sales/bulk \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
[
  { "salesperson_name": "Andi",  "city_name": "Jakarta",  "product_name": "Honda",  "amount": 120000000 },
  { "salesperson_name": "Andi",  "city_name": "Bandung",  "product_name": "Yamaha", "amount": 90000000 },
  { "salesperson_name": "Budi",  "city_name": "Jakarta",  "product_name": "Suzuki", "amount": 80000000 },
  { "salesperson_name": "Budi",  "city_name": "Surabaya", "product_name": "Honda",  "amount": 95000000 },
  { "salesperson_name": "Citra", "city_name": "Bandung",  "product_name": "Suzuki", "amount": 70000000 },
  { "salesperson_name": "Citra", "city_name": "Surabaya", "product_name": "Yamaha", "amount": 85000000 },
  { "salesperson_name": "Andi",  "city_name": "Jakarta",  "product_name": "Yamaha", "amount": 75000000 }
]
EOF
```

Format file `data_awal.csv` (kolom sama dengan yang dipakai fitur upload):
```
Nama Sales,Kota,Produk,Penjualan
```

### Menjalankan dev

```bash
npm run dev:backend    # API di http://localhost:3000/api
npm run dev:frontend   # UI di http://localhost:5173 (proxy /api → backend)
```

### Test

```bash
npm test
```

Unit test berjalan tanpa database (validasi, SQL builder, pivot terhadap contoh-contoh di assignment, CSV). Integration test (`test/db.integration.test.js`) memakai PostgreSQL embedded (PGlite) sehingga juga berjalan tanpa server eksternal.

### Reset Database

Jika Anda telah menambahkan banyak data percobaan (misalnya via upload CSV atau input manual) dan ingin mengembalikan database ke **keadaan awal (hanya berisi 7 transaksi default)**, Anda dapat menjalankan perintah *seed* kembali dari terminal:

```bash
npm run db:seed
```

Perintah ini bersifat *idempotent*; di mana ia akan melakukan `TRUNCATE` (mengosongkan seluruh isi tabel) terlebih dahulu, lalu memasukkan ulang 7 data transaksi bawaan.

---

## Dokumentasi API

Dokumentasi lengkap dengan contoh request/response ada di **[docs/API.md](docs/API.md)**. 
Aplikasi juga menyediakan **Interactive API Docs (Swagger / OpenAPI)** yang dapat diakses di endpoint `/api/docs` setelah backend dijalankan.

Ringkasan Endpoint Utama:

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/health` | Status kesehatan |
| GET | `/api/meta/fields` | Dimensi, measure, perhitungan, operator (untuk dropdown UI) |
| POST | `/api/reports` | Bangun laporan → hasil pivot |
| POST | `/api/reports/export` | Unduh hasil laporan sebagai CSV |
| GET/POST | `/api/reports/saved` | Daftar / simpan konfigurasi laporan |
| GET/PUT/DELETE | `/api/reports/saved/:id` | Detail / ubah / hapus laporan tersimpan |
| POST | `/api/sales` | Tambah transaksi baru (manual entry) |
| POST | `/api/sales/bulk` | Tambah banyak transaksi sekaligus dari JSON (untuk upload CSV/XLSX) |

### Cara Mengakses Swagger OpenAPI
1. Pastikan server backend sedang berjalan (jalankan `npm run dev:backend` di terminal).
2. Buka browser dan kunjungi: **`http://localhost:3000/api/docs`** (local) atau **`https://sales-report-backend-eight.vercel.app/api/docs`**
3. Anda dapat melihat seluruh endpoint yang tersedia beserta format request/response-nya, dan mengujinya langsung menggunakan tombol **"Try it out"**.

---

## Deployment (Vercel + Supabase, gratis)

Stack ini sengaja dirancang agar bisa di-deploy **gratis tanpa kartu kredit dan tanpa masa trial**:

| Komponen | Hosting | Alasan |
|---|---|---|
| Database | **Supabase** (free tier, Postgres 500 MB) | Tanpa kartu, tidak kadaluarsa. Lebih baik daripada Render Postgres (expire 30 hari) |
| Backend | **Vercel** serverless (`api/index.js`) | Tanpa kartu, tanpa trial; fungsi Node jalan di jalur `/api/*` |
| Frontend | **Vercel** statik (output `frontend/dist`) | Satu proyek, same-origin dengan API (tidak perlu CORS) |

Catatan: Docker Space Hugging Face saat ini berbayar; Render free kini meminta kartu kredit. Kombinasi di atas adalah jalur "free forever" tanpa kartu.

### Langkah-langkah

1. **Supabase**: buat project → ambil connection string transaction pooler (port `6543`, mode transaction) → simpan sebagai `DATABASE_URL`.
2. Jalankan migrasi dan seeder dari mesin lokal sekali:
   ```bash
   npm run db:migrate && npm run db:seed
   ```
3. **Vercel**: push repo ke GitHub → import di Vercel (pakai Hobby/free). Pengaturan sudah tersedia di `vercel.json` (build `npm run build`, output `frontend/dist`). Tambahkan environment variable `DATABASE_URL` di dashboard.
4. `api/index.js` otomatis menjadi fungsi serverless untuk semua rute `/api/*`. SPA ditebalkan ke `index.html` via rewrite (rute `/api/*` tetap diteruskan ke fungsi).

Setelah deploy, SPA memanggil `/api` same-origin — tidak ada konfigurasi CORS yang perlu diatur.

---

## Penjelasan Teknis (poin penilaian)

**1. Bagaimana struktur database dirancang?**
Star schema: satu fact table `sales` + tabel dimensi `salespeople`, `cities`, `products`. Faktanya ringan dan tiap dimensi bernilai master yang konsisten; `saved_reports` menyimpan konfigurasi laporan sebagai JSONB.

**2. Bagaimana backend membentuk query berdasarkan pilihan pengguna?**
Konfigurasi divalidasi terhadap whitelist, lalu `QueryBuilder` menyusun `SELECT`/`JOIN`/`WHERE`/`GROUP BY GROUPING SETS` secara dinamis. Semua kombinasi baris×kolom×nilai×filter dilayani mekanisme yang sama.

**3. Bagaimana keamanan query dinamis dijaga?**
Tidak ada interpolasi input. Nama kolom diambil dari whitelist; nilai filter memakai parameterized query; `ORDER BY` hanya alias internal. Field/operator asing langsung ditolak dengan `400`.

**4. Bagaimana frontend membentuk tabel dengan kolom yang berubah-ubah?**
Backend mengembalikan metadata (`rowFields`, `columnField`, `valueColumns`, `columnKeys`) dan sel ber-array. Komponen `ReportTable` merender header berlapis dari metadata tersebut, bukan dari konstanta hardcoded — kolom Jakarta/Bandung/Surabaya muncul dari data.

**5. Bagaimana menangani nilai yang tidak memiliki data?**
GROUPING SETS tidak memunculkan kombinasi yang tidak ada datanya; `pivot` mengisi nol untuk kombinasi tersebut, sehingga tabel selalu rapi (sesuai contoh Rp0 di assignment).

**6. Bagaimana menambahkan dimensi baru (tanggal, cabang, kategori)?**
Tambah tabel dimensi + kolom FK + index di `sales`. `core/ReportSchema.js` mengintrospeksi foreign key dan kolom saat runtime, lalu mendaftarkan field baru secara otomatis (label ramah diatur lewat `DEFAULT_LABELS` di file yang sama). Mesin query dan frontend otomatis mendukungnya tanpa perubahan lain. Untuk dimensi waktu, tambahkan kolom `sale_date` + index.

**7. Apa kendala teknis utama?**
- Menjaga total `avg` tetap benar: diselesaikan dengan GROUPING SETS agar total dihitung PostgreSQL dari data mentah.
- Express di serverless: `pg` pool diset kecil (`max: 5`) dan memakai Supabase pooler; aplikasi diekspor dari `api/index.js` tanpa adapter tambahan.
- Tabel lebar (banyak nilai kolom) butuh scroll horizontal — ditangani container `overflow-x`.

**8. Apa yang akan diperbaiki untuk data dalam jumlah besar?**
Index sudah ada; berikutnya: partisi `sales` per `created_at`, pre-agregasi harian (materialized view atau tabel ringkas), pagination pada hasil baris, caching respons per hash konfigurasi (Redis atau CDN), serta penyesuaian ukuran pool sesuai concurrency.

---

## Catatan

- Aplikasi hanya menampilkan laporan yang dibentuk pengguna; tidak ada daftar laporan siap pakai yang meng-copy contoh-contoh di assignment. Semua contoh di assignment tetap valid sebagai kombinasi konfigurasi.
- Bahasa interface dan pesan aplikasi menggunakan Bahasa Indonesia sesuai konteks.
