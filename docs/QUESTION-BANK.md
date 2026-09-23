# Bank Pertanyaan, Agregasi, dan Katalog Field

Dokumen ini menjelaskan tiga hal yang ditambahkan setelah fitur pivot dasar:

1. **Agregasi** dan pemetaan rumus Excel ke notasi program.
2. **Bank pertanyaan** ("Pertanyaan populer" / *people also ask*) yang mengisi pivot otomatis.
3. **Katalog field** yang dibaca dari database, bukan ditulis di kode backend.

---

## 1. Pemetaan rumus Excel ke notasi program

Rumus di `md/list-pertanyaan.md` dipetakan ke operasi agregasi backend. Semua SQL
dibangun di `backend/src/core/QueryBuilder.js` dari konfigurasi laporan
(`rows` = GROUP BY, `filters` = WHERE, `values` = agregasi).

| Rumus Excel | Operasi (`aggregation`) | SQL | Judul kolom pivot |
| --- | --- | --- | --- |
| `=SUM(E4:E11)` | `sum` | `SUM(kolom)` | Total \<Field\> |
| `=SUMIF(C4:C11,A16,E4:E11)` | `sum` + 1 filter | `WHERE kota = $1` | Total \<Field\> |
| `=SUMIFS(E4:E11,C4:C11,A16,D4:D11,B16)` | `sum` + 2 filter | `WHERE kota = $1 AND produk = $2` | Total \<Field\> |
| `=AVERAGEIF/AVERAGEIFS(...)` | `avg` | `AVG(kolom)` | Rata-rata \<Field\> |
| `=COUNTIF/COUNTIFS(...)` | `count` | `COUNT(kolom)` | Jumlah Transaksi |
| `=COUNTA(UNIQUE(FILTER(...)))` | `count_unique` | `COUNT(DISTINCT kolom)` | Jumlah \<Field\> |

Agregasi default ditentukan per tipe field (`defaultFor` pada definisi agregasi,
bukan ditulis di UI): **angka → `sum`**, **teks → `count_unique`**. Jadi memilih
field Kota sebagai nilai langsung memakai `COUNT(DISTINCT ...)` / kolom "Jumlah
Kota" tanpa perlu dipilih manual.

Operator filter (dari `meta.operators`, lihat `ReportSchema.OPERATORS`):

| Rumus Excel | Operator UI | SQL |
| --- | --- | --- |
| `=`, `SUMIF`, `COUNTIF` | `=` | `= $n` |
| `"<>"&B16` | `!=` | `<> $n` |
| `>`, `<`, `>=`, `<=` | `>`, `<`, `>=`, `<=` | `> $n`, dst. |
| (teks mengandung) | `contains` | `ILIKE '%nilai%'` |
| (rentang angka) | `between` | `BETWEEN $n AND $n+1` |

### "Jumlah Transaksi" vs "Jumlah"

Keduanya menjawab pertanyaan berbeda — persis seperti catatan di
`md/list-pertanyaan.md`: **"berapa sales" ≠ "berapa transaksi"**.

Untuk Andi yang punya tiga baris data (Jakarta–Honda, Jakarta–Yamaha,
Bandung–Yamaha):

| Pertanyaan | Nilai | Konfigurasi |
| --- | --- | --- |
| Ada berapa baris transaksi Andi? | **3** | Nilai: `Jumlah Transaksi` |
| Andi menjual di berapa kota berbeda? | **2** | Nilai: `Jumlah` pada field `Kota` |
| Ada berapa sales yang menjual Honda? | **2** | Nilai: `Jumlah` pada field `Nama Sales`, filter `Produk = Honda` |

Agregasi bersifat umum: `count_unique` menghitung nilai unik **pada kolom yang
dipilih**, jadi tidak ada aturan yang dikunci ke dataset tertentu. Karena sudah
jadi default untuk field teks, `count_unique` ditandai `hidden` di definisi
agregasi: tidak muncul sebagai pilihan di dropdown, tetapi labelnya tetap
ditampilkan saat sedang dipakai.

`count` (Jumlah Transaksi) untuk sementara juga ditandai `hidden`, sehingga
dropdown perhitungan hanya berisi **Total / Rata-rata / Minimum / Maksimum**.
Backend tetap mendukung `COUNT`, jadi pertanyaan bank yang memakai "berapa
transaksi" tetap berjalan (judul kolomnya "Jumlah Transaksi"), dan flag
`hidden` cukup dihapus untuk menampilkannya lagi di dropdown. Untuk field teks,
kontrol perhitungan tidak ditampilkan sama sekali karena agregasinya sudah
otomatis (`count_unique`).

---

## 2. Bank pertanyaan ("Pertanyaan populer")

- Data pertanyaan: `frontend/src/utils/questionBank.js`.
- Panelnya: `frontend/src/components/QuestionBank.vue`, dipasang tepat di bawah
  toolbar pivot (di bawah tombol **Filter**) pada setiap blok laporan
  (`ReportBlock.vue`).
- Panel ini berperilaku seperti dropdown: **tertutup secara default**, begitu
  juga tiap grupnya — pengguna membuka seperlunya.
- Saat sebuah pertanyaan diklik, `useReportBuilder.applyQuestion()` mengganti
  **baris + nilai + filter** blok tersebut, lalu laporan dijalankan otomatis.

Struktur satu entri:

```js
{
  text: 'Berapa total penjualan Honda di Jakarta?',
  aggregation: 'sum',            // sum | avg | count | count_unique
  field: 'amount',               // field yang diagregasi
  filters: [
    { field: 'product', operator: '=', value: 'Honda' },
    { field: 'city',    operator: '=', value: 'Jakarta' },
  ],
  rows: [],                      // opsional: pengelompokan (GROUP BY)
}
```

Isinya 8 grup berisi 49 pertanyaan, dikelompokkan mengikuti pola
satu dimensi → dua dimensi → tiga dimensi, ditambah grup pengecualian.
Judul grup sengaja memakai bahasa analisa supaya mudah dipilih:

| Grup | Jml | Contoh pertanyaan |
| --- | -: | --- |
| Penjualan per Sales | 6 | Berapa total penjualan Andi? |
| Penjualan per Kota | 6 | Berapa transaksi di Bandung? |
| Penjualan per Produk | 6 | Ada berapa sales yang menjual Honda? |
| Penjualan per Sales & Kota | 6 | Andi menangani berapa kota? |
| Penjualan per Sales & Produk | 6 | Berapa total penjualan Honda oleh Andi? |
| Penjualan per Kota & Produk | 6 | Berapa transaksi Yamaha di Bandung? |
| Penjualan per Sales, Kota & Produk | 6 | Berapa penjualan Budi untuk Honda di Surabaya? |
| Penjualan dengan Pengecualian | 7 | Berapa total penjualan Honda selain Andi? |

Daftar lengkap tiap pertanyaan ada di `frontend/src/utils/questionBank.js`;
menambah pertanyaan baru cukup menambah entri pada `items` (nilai
kota/produk/sales mengikuti isi dataset).

---

## 3. Katalog field dari database

Sebelumnya nama field, label, tabel relasi, dan kolom foreign key ditulis di
`backend/src/core/ReportSchema.js`. Sekarang backend hanya berisi **logika**:

- `ReportSchema.loadFromDatabase()` membaca struktur tabel sumber dari
  `information_schema` (kolom + foreign key).
- Label dan key field dibaca dari tabel katalog **`field_catalog`**
  (migrasi `backend/db/migrations/004_field_catalog.sql`).

```sql
CREATE TABLE field_catalog (
  source_column    TEXT PRIMARY KEY,  -- kolom di tabel sumber, mis. 'salesperson_id'
  field_key        TEXT NOT NULL,     -- key di konfigurasi laporan, mis. 'sales_name'
  label            TEXT NOT NULL,     -- judul di UI, mis. 'Nama Sales'
  reference_column TEXT               -- kolom di tabel relasi, mis. 'name'
);
```

Aturannya:

- Kolom foreign key jadi **dimensi** (JOIN ke tabel relasinya, dibaca dari
  `reference_column`); kolom biasa jadi dimensi biasa.
- `id` dan `created_at` diabaikan (kolom pembukuan).
- Bila sebuah kolom tidak punya baris di katalog, key dan labelnya **diturunkan
  dari nama kolom** (`salesperson_id` → key `salesperson`, label `Salesperson`),
  jadi aplikasi tetap jalan. Migrasi `004` sudah mengisi katalog untuk dataset
  penjualan ini, sehingga key lama (`sales_name`) tetap dipakai dan laporan
  tersimpan tetap valid.

### Menyesuaikan dengan dataset lain

1. Ganti tabel `sales` (dan tabel relasinya) lewat migrasi Anda sendiri.
2. Isi `field_catalog` untuk setiap kolom yang ingin ditampilkan:
   `source_column` = nama kolom, `field_key` = key untuk konfigurasi,
   `label` = judul di UI.
3. Jalankan `npm run db:migrate`.

Kolom yang tidak ada di katalog otomatis muncul dengan key/label turunan, jadi
tidak wajib mengisi semuanya.

### Konvensi yang masih dipakai

- Tabel sumber tetap bernama `sales` (konstanta `ROOT_TABLE` di `ReportSchema.js`).
- Foreign key dianggap mengarah ke kolom primary key `id` tabel relasi.

---

## 4. Menjalankan, RLS, dan deploy

```bash
npm run db:migrate     # WAJIB: katalog field (004) + RLS (005)
npm run dev
npm test               # 70 tes backend (unit + integrasi PGlite)
```

### Row Level Security

`backend/db/migrations/005_enable_rls.sql` mengaktifkan RLS untuk seluruh tabel
(`salespeople`, `cities`, `products`, `sales`, `saved_reports`, `category_colors`,
`table_styles`, `field_catalog`) tanpa policy apa pun. Konsekuensinya:

- Backend tetap berjalan karena koneksinya memakai role **pemilik tabel**
  (`postgres`, atau `postgres.<ref>` di Supabase), dan pemilik tabel tidak
  terkena RLS.
- Akses langsung ke tabel lewat PostgREST/Supabase API (role `anon` /
  `authenticated`) tertutup, karena tidak ada policy yang mengizinkan. Sudah
  diuji: role non-pemilik dengan `GRANT SELECT` melihat **0 baris** dari `sales`.

Migrasi ini tidak memakai `FORCE ROW LEVEL SECURITY`; kalau suatu saat backend
dipindah ke role non-pemilik, role tersebut perlu policy sendiri.

> **Deploy:** perubahan ini menambah dua migrasi baru (`004` katalog field dan
> `005` RLS). Jalankan `npm run db:migrate` ke database produksi (Supabase)
> **sebelum** backend versi baru melayani permintaan, karena key field dibaca
> dari `field_catalog`. Tanpa migrasi `004`, aplikasi tetap berjalan tetapi
> memakai key turunan (`salesperson`) sehingga laporan tersimpan yang lama tidak
> cocok lagi.

Agregasi `count_unique` terverifikasi lewat SQL asli di
`backend/test/db.integration.test.js`, termasuk operator `!=`.
