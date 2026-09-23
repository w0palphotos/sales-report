# Keamanan

Ringkasan hasil pemeriksaan keamanan aplikasi (API Express di `backend/` + fungsi
Vercel `api/index.js` + PostgreSQL/Supabase) beserta kontrol yang sudah dipasang
dan test yang menjaganya.

Jalankan suite keamanannya:

```bash
cd backend
npm test                    # seluruh tes, termasuk test/security/
node --test test/security   # hanya suite keamanan
```

---

## 1. Yang sudah aman

| Area | Kondisi |
| --- | --- |
| Injeksi SQL | Semua nilai user dikirim sebagai **parameter terikat** (`$1`, `$2`, …). Nama field/tabel/kolom hanya boleh berasal dari metadata schema, dan dicek dengan allowlist (`rows`, `columns`, `values.field`, `values.aggregation`, `filters.field`, `filters.operator`). Tidak ada string user yang masuk ke teks SQL. |
| Validasi input | Field/agregasi/operator asing ditolak 400 sebelum menyentuh database; `rows` maks 3, `columns` maks 1, `values` maks 8; kolom `amount` dicek `Number.isFinite`. |
| Kebocoran error | Error 5xx selalu menjadi `{"error":"Terjadi kesalahan pada server."}` (stack trace & pesan SQL tidak ikut keluar); pesan asli hanya untuk 4xx. |
| Header | `x-powered-by` dimatikan. |
| Aturan warna/gaya | Nilai harus hex (`#rgb`/`#rrggbb`), maks 500 aturan, panjang nilai dibatasi. |
| ID laporan | Wajib bilangan bulat ≥ 1 (`parseId`) sebelum dijadikan parameter query. |
| Rahasia | `.env` ada di `.gitignore` dan tidak pernah ter-commit. |
| Akses langsung DB | RLS aktif di seluruh tabel (migrasi `005`). Akses lewat PostgREST/Supabase API (role `anon`/`authenticated`) tertutup karena tidak ada policy. |

## 2. Kontrol yang ditambahkan

| Kontrol | Default | Diatur lewat |
| --- | --- | --- |
| Pembatas permintaan (sliding window per IP) → `429` + `Retry-After` | 120 permintaan / 60 detik | `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` |
| CORS allowlist (tidak ada header bila kosong) | kosong = same-origin saja | `ALLOWED_ORIGINS` |
| Batas ukuran body JSON → `413` | `2mb` | `JSON_BODY_LIMIT` |
| Batas baris per unggahan → `400` | 1000 baris | `MAX_BULK_ROWS` |
| Batas baris respons `GET /api/sales` | 5000 baris | `MAX_SALES_ROWS` |
| Batas nama dimensi / nilai `amount` | 200 karakter / maks `99.999.999.999,99` (NUMERIC(14,2)) | — |
| Percaya `X-Forwarded-For` untuk IP asli (Vercel = 1 hop) | 1 | `TRUST_PROXY` |

`insertSales` juga diubah dari "3 select + 3 insert per baris" menjadi **satu
select + satu insert per tabel dimensi** dan satu `INSERT` banyak-baris untuk
transaksinya, sehingga jumlah query tidak lagi tumbuh mengikuti jumlah baris.

## 3. Test yang menjaga

| Berkas | Cakupan |
| --- | --- |
| `test/security/sqlInjection.test.js` | 11 payload injeksi (kutip, `OR 1=1`, `DROP TABLE`, `COPY … PROGRAM`, `UNION SELECT`, dsb.) pada semua input: nilai filter (`=`, `contains`, angka), nama field/kolom, agregasi, operator. Memastikan payload selalu jadi parameter dan tidak pernah muncul di teks SQL, serta tidak ada statement/komentar tambahan. Termasuk penolakan `__proto__`/`constructor`. |
| `test/security/rateLimit.test.js` | Batas terlampaui → `429` + `Retry-After`, perhitungan per IP, berlaku juga di endpoint data. |
| `test/security/apiHardening.test.js` | CORS (same-origin, origin asing, preflight, origin terdaftar), body 3 MB → `413`, batas `rows`/`values`, id laporan non-integer → `400`, `x-powered-by` tidak ada, error 5xx tidak membocorkan detail, response yang sudah terkirim tidak ditulis ulang, dan `Object.prototype` tidak bisa dicemari lewat body JSON. |
| `test/security/inputValidation.test.js` | Validasi transaksi: field wajib, `amount` (negatif/NaN/overflow), panjang nama, batas 1000 baris, tidak ada baris tersisip saat input ditolak, dan nama berisi kutip disimpan sebagai data biasa (tabel `sales` tetap utuh). |
| `test/security/rls.test.js` | RLS aktif di 8 tabel, tanpa `FORCE ROW LEVEL SECURITY` (pemilik tetap bisa akses), dan role non-pemilik tanpa policy melihat **0 baris**. |

## 4. Risiko yang belum ditangani

1. **Tidak ada autentikasi.** Siapa pun yang bisa menjangkau URL API dapat
   membaca seluruh data, menambah transaksi, dan menghapus laporan tersimpan.
   Ini risiko terbesar. Pilihan penanganan: Supabase Auth (paling rapi),
   API key sederhana lewat header (cukup untuk menutup akses asal-asalan, tapi
   kunci yang ditanam di frontend bisa dilihat siapa pun), atau memakai
   Deployment Protection/password dari platform hosting.
2. **Pembatas permintaan bersifat best-effort.** State-nya di memori proses; di
   Vercel setiap instance punya hitungannya sendiri. Untuk proteksi menyeluruh
   gunakan rate limit di edge/WAF.
3. **`ssl: { rejectUnauthorized: false }`** untuk database jarak jauh: koneksi
   terenkripsi tetapi sertifikat tidak diverifikasi (risiko MITM). Bila provider
   menyediakan CA certificate, pasang agar bisa diverifikasi.
4. **`/api/docs` (Swagger UI) terbuka untuk umum** — hanya informasi skema API,
   tapi bisa dimatikan di produksi bila tidak diperlukan.
5. **Tidak ada audit log** untuk operasi tulis (tambah transaksi, hapus laporan).

## 5. Checklist konfigurasi database

- [x] RLS aktif di semua tabel aplikasi (migrasi `005_enable_rls.sql`)
- [x] Tidak memakai `FORCE ROW LEVEL SECURITY`, jadi backend (pemilik tabel) tetap berjalan
- [x] Tidak ada peran/aplikasi dengan hak superuser di runtime backend
- [x] Kredensial database disimpan di environment variable, bukan di repo
- [x] Query dinamis seluruhnya terparameter
- [ ] Verifikasi sertifikat TLS database (butuh CA dari provider)
- [ ] Audit log & alert untuk operasi tulis
- [x] Migrasi dijalankan sebelum deploy (`004` katalog field, `005` RLS)

> Catatan: jalankan `npm run db:migrate` ke database produksi sebelum backend
> versi baru melayani permintaan, karena key field dibaca dari `field_catalog`
> dan RLS baru aktif setelah migrasi `005`.
