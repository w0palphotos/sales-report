# Database Entity-Relationship Diagram

## Skema Tabel & Relasi

### Tabel `salespeople`
| Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| **id** | `INTEGER` | **Primary Key**, SERIAL |
| **name** | `TEXT` | UNIQUE, NOT NULL |

### Tabel `cities`
| Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| **id** | `INTEGER` | **Primary Key**, SERIAL |
| **name** | `TEXT` | UNIQUE, NOT NULL |

### Tabel `products`
| Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| **id** | `INTEGER` | **Primary Key**, SERIAL |
| **name** | `TEXT` | UNIQUE, NOT NULL |

### Tabel `sales` (Tabel Transaksi/Fakta)
| Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| **id** | `BIGINT` | **Primary Key**, BIGSERIAL |
| **salesperson_id** | `INTEGER` | **Foreign Key** ke `salespeople(id)`, NOT NULL |
| **city_id** | `INTEGER` | **Foreign Key** ke `cities(id)`, NOT NULL |
| **product_id** | `INTEGER` | **Foreign Key** ke `products(id)`, NOT NULL |
| **amount** | `NUMERIC` | NOT NULL, `CHECK (amount >= 0)` |
| **created_at** | `TIMESTAMPTZ`| NOT NULL, `DEFAULT now()` |

### Tabel `saved_reports`
| Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| **id** | `INTEGER` | **Primary Key**, SERIAL |
| **name** | `TEXT` | NOT NULL |
| **config** | `JSONB` | NOT NULL |
| **created_at** | `TIMESTAMPTZ`| NOT NULL, `DEFAULT now()` |

### Tabel `category_colors`
| Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| **id** | `INTEGER` | **Primary Key**, SERIAL |
| **field** | `TEXT` | NOT NULL, kunci dimensi |
| **value** | `TEXT` | NOT NULL, nilai kategori |
| **bg** | `TEXT` | NOT NULL, warna latar (hex) |
| **color** | `TEXT` | NOT NULL, warna teks (hex) |
| **created_at** | `TIMESTAMPTZ`| NOT NULL, `DEFAULT now()` |
| | | UNIQUE (`field`, `value`) |

### Tabel `table_styles`
| Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| **id** | `INTEGER` | **Primary Key**, SERIAL |
| **kind** | `TEXT` | NOT NULL, `CHECK (kind IN ('row','column'))` |
| **key** | `TEXT` | NOT NULL, kunci posisional |
| **bg** | `TEXT` | NOT NULL, warna latar (hex) |
| **color** | `TEXT` | NOT NULL, warna teks (hex) |
| **created_at** | `TIMESTAMPTZ`| NOT NULL, `DEFAULT now()` |
| | | UNIQUE (`kind`, `key`) |

### Relasi Antar Tabel
- **`salespeople`** (1) ── (N) **`sales`**
- **`cities`** (1) ── (N) **`sales`**
- **`products`** (1) ── (N) **`sales`**

## Penjelasan Struktur Database

1.  **Tabel Dimensi (`salespeople`, `cities`, `products`)**:
    *   Setiap entitas (Sales, Kota, Produk) dipisahkan ke dalam tabel master (dimensi) masing-masing.
    *   Hal ini dilakukan untuk menjaga integritas data dan mengurangi redundansi. Nama sales, kota, dan produk dijamin unik (`UNIQUE` constraint).
    *   Jika perusahaan menambahkan atribut baru (misal: "Wilayah" untuk kota, atau "Kategori" untuk produk), struktur ini sangat mudah dikembangkan (cukup tambahkan kolom di tabel master terkait).
2.  **Tabel Fakta (`sales`)**:
    *   Tabel ini menyimpan data transaksi (fakta penjualan).
    *   Menggunakan *Foreign Key* (`salesperson_id`, `city_id`, `product_id`) untuk menghubungkan transaksi dengan tabel dimensi.
    *   `amount` menyimpan nilai penjualan. Terdapat constraint `CHECK (amount >= 0)` untuk menghindari data penjualan bernilai negatif.
    *   Terdapat indeks (index) pada setiap foreign key (`salesperson_id`, `city_id`, `product_id`) untuk memastikan query laporan berjalan dengan sangat cepat (mengoptimalkan `JOIN` dan `GROUP BY`).
3.  **Tabel Pengaturan (`saved_reports`)**:
    *   Digunakan untuk menyimpan konfigurasi laporan pengguna (opsional/bonus fitur).
    *   Menggunakan tipe data `JSONB` pada kolom `config` yang memungkinkan fleksibilitas tinggi jika struktur filter, baris, dan kolom berkembang.
    *   Kolom `config` juga menyimpan override warna laporan ini, termasuk warna header kolom (`header:<key>`) dan warna satu sel (`cell:<rowSignature>::<columnId>`) yang tidak masuk ke `table_styles`.
4.  **Tabel Aturan Warna (`category_colors`, `table_styles`)**:
    *   `category_colors` menyimpan warna per kategori dimensi (mis. kota `Jakarta`) dan berlaku di semua laporan.
    *   `table_styles` menyimpan warna posisional baris (`row`) dan kolom (`column`), dengan `key` seperti `rowdim:city`, `col:city:Jakarta`, atau `val:amount:max`.
    *   Keduanya diisi replace-all lewat `PUT /api/colors` dan `PUT /api/table-styles`; mengirim array kosong menghapus semua aturan.
