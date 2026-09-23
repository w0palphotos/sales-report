// Bank pertanyaan "People also ask" — struktur 1 dimensi → 2 dimensi → 3 dimensi
// sesuai md/list-pertanyaan copy.md. Tiap entri adalah padanan program dari
// rumus Excel-nya:
//
//   SUMIF / SUMIFS               -> sum          (Total)
//   COUNTIF / COUNTIFS           -> count        (Jumlah Transaksi)
//   COUNTA(UNIQUE(FILTER(...)))  -> count_unique (Jumlah, default field teks)
//   AVERAGEIF / AVERAGEIFS       -> avg          (Rata-rata)
//
// `filters` menjadi kondisi (WHERE), `rows` menjadi pengelompokan (GROUP BY).
// Operator `!=` mewakili `"<>"` (selain/tanpa/kecuali).
// Nilai yang dipakai (Honda/Jakarta/Andi) mengikuti isi dataset.

const AMOUNT = 'amount';
const SALES_FIELD = 'sales_name';
const CITY = 'city';
const PRODUCT = 'product';

const is = (field, value) => ({ field, operator: '=', value });
const isNot = (field, value) => ({ field, operator: '!=', value });

const total = (text, filters = [], rows = []) => ({ text, aggregation: 'sum', field: AMOUNT, filters, rows });
const average = (text, filters = []) => ({ text, aggregation: 'avg', field: AMOUNT, filters, rows: [] });
const transactions = (text, filters = []) => ({ text, aggregation: 'count', field: AMOUNT, filters, rows: [] });
const unique = (text, target, filters = []) => ({
  text,
  aggregation: 'count_unique',
  field: target,
  filters,
  rows: [],
});

export const QUESTION_GROUPS = [
  {
    title: 'Penjualan per Sales',
    items: [
      total('Berapa total penjualan masing-masing sales?', [], [SALES_FIELD]),
      total('Berapa total penjualan Andi?', [is(SALES_FIELD, 'Andi')]),
      transactions('Berapa transaksi yang dilakukan Andi?', [is(SALES_FIELD, 'Andi')]),
      average('Berapa rata-rata penjualan Andi?', [is(SALES_FIELD, 'Andi')]),
      unique('Ada berapa kota yang ditangani Andi?', CITY, [is(SALES_FIELD, 'Andi')]),
      unique('Ada berapa produk berbeda yang dijual Andi?', PRODUCT, [is(SALES_FIELD, 'Andi')]),
    ],
  },
  {
    title: 'Penjualan per Kota',
    items: [
      total('Berapa total penjualan masing-masing kota?', [], [CITY]),
      total('Berapa total penjualan di Jakarta?', [is(CITY, 'Jakarta')]),
      transactions('Berapa transaksi di Bandung?', [is(CITY, 'Bandung')]),
      average('Berapa rata-rata penjualan di Surabaya?', [is(CITY, 'Surabaya')]),
      unique('Ada berapa sales yang berjualan di Jakarta?', SALES_FIELD, [is(CITY, 'Jakarta')]),
      unique('Ada berapa produk yang dijual di Bandung?', PRODUCT, [is(CITY, 'Bandung')]),
    ],
  },
  {
    title: 'Penjualan per Produk',
    items: [
      total('Berapa total penjualan masing-masing produk?', [], [PRODUCT]),
      total('Berapa total penjualan Honda?', [is(PRODUCT, 'Honda')]),
      transactions('Ada berapa transaksi Yamaha?', [is(PRODUCT, 'Yamaha')]),
      average('Berapa rata-rata penjualan Suzuki?', [is(PRODUCT, 'Suzuki')]),
      unique('Ada berapa sales yang menjual Honda?', SALES_FIELD, [is(PRODUCT, 'Honda')]),
      unique('Ada berapa kota yang menjual Yamaha?', CITY, [is(PRODUCT, 'Yamaha')]),
    ],
  },
  {
    title: 'Penjualan per Sales & Kota',
    items: [
      total('Berapa total penjualan setiap sales di setiap kota?', [], [SALES_FIELD, CITY]),
      total('Berapa total penjualan Andi di Jakarta?', [is(SALES_FIELD, 'Andi'), is(CITY, 'Jakarta')]),
      transactions('Berapa transaksi Andi di Jakarta?', [is(SALES_FIELD, 'Andi'), is(CITY, 'Jakarta')]),
      unique('Andi menangani berapa kota?', CITY, [is(SALES_FIELD, 'Andi')]),
      total('Berapa total penjualan Budi di Surabaya?', [is(SALES_FIELD, 'Budi'), is(CITY, 'Surabaya')]),
      total('Sales mana yang berjualan di masing-masing kota?', [], [CITY, SALES_FIELD]),
    ],
  },
  {
    title: 'Penjualan per Sales & Produk',
    items: [
      total('Berapa total penjualan setiap sales untuk masing-masing produk?', [], [SALES_FIELD, PRODUCT]),
      total('Berapa total penjualan Honda oleh Andi?', [is(SALES_FIELD, 'Andi'), is(PRODUCT, 'Honda')]),
      transactions('Berapa transaksi Yamaha oleh Citra?', [is(SALES_FIELD, 'Citra'), is(PRODUCT, 'Yamaha')]),
      total('Produk apa saja yang dijual Andi?', [is(SALES_FIELD, 'Andi')], [PRODUCT]),
      unique('Ada berapa produk berbeda yang dijual Budi?', PRODUCT, [is(SALES_FIELD, 'Budi')]),
      unique('Berapa sales yang menjual Honda?', SALES_FIELD, [is(PRODUCT, 'Honda')]),
    ],
  },
  {
    title: 'Penjualan per Kota & Produk',
    items: [
      total('Berapa total penjualan setiap produk di masing-masing kota?', [], [CITY, PRODUCT]),
      total('Berapa total penjualan Honda di Jakarta?', [is(PRODUCT, 'Honda'), is(CITY, 'Jakarta')]),
      transactions('Berapa transaksi Yamaha di Bandung?', [is(PRODUCT, 'Yamaha'), is(CITY, 'Bandung')]),
      total('Produk apa saja yang dijual di Surabaya?', [is(CITY, 'Surabaya')], [PRODUCT]),
      unique('Ada berapa produk berbeda yang dijual di Jakarta?', PRODUCT, [is(CITY, 'Jakarta')]),
      total('Berapa total penjualan Suzuki di Bandung?', [is(PRODUCT, 'Suzuki'), is(CITY, 'Bandung')]),
    ],
  },
  {
    title: 'Penjualan per Sales, Kota & Produk',
    items: [
      total('Berapa total penjualan Andi untuk Honda di Jakarta?', [
        is(SALES_FIELD, 'Andi'),
        is(PRODUCT, 'Honda'),
        is(CITY, 'Jakarta'),
      ]),
      transactions('Berapa transaksi Andi untuk Yamaha di Jakarta?', [
        is(SALES_FIELD, 'Andi'),
        is(PRODUCT, 'Yamaha'),
        is(CITY, 'Jakarta'),
      ]),
      total('Berapa penjualan Budi untuk Honda di Surabaya?', [
        is(SALES_FIELD, 'Budi'),
        is(PRODUCT, 'Honda'),
        is(CITY, 'Surabaya'),
      ]),
      total('Berapa total penjualan Citra untuk Suzuki di Bandung?', [
        is(SALES_FIELD, 'Citra'),
        is(PRODUCT, 'Suzuki'),
        is(CITY, 'Bandung'),
      ]),
      total('Siapa sales yang menjual Honda di Jakarta?', [is(PRODUCT, 'Honda'), is(CITY, 'Jakarta')], [
        SALES_FIELD,
      ]),
      transactions('Berapa transaksi Yamaha yang dilakukan Andi di Jakarta?', [
        is(SALES_FIELD, 'Andi'),
        is(PRODUCT, 'Yamaha'),
        is(CITY, 'Jakarta'),
      ]),
    ],
  },
  {
    title: 'Penjualan dengan Pengecualian',
    items: [
      total('Berapa total penjualan Honda selain Andi?', [is(PRODUCT, 'Honda'), isNot(SALES_FIELD, 'Andi')]),
      total('Berapa total penjualan Jakarta tanpa Budi?', [is(CITY, 'Jakarta'), isNot(SALES_FIELD, 'Budi')]),
      transactions('Berapa transaksi Yamaha selain Citra?', [is(PRODUCT, 'Yamaha'), isNot(SALES_FIELD, 'Citra')]),
      total('Berapa penjualan Honda di Jakarta selain Andi?', [
        is(PRODUCT, 'Honda'),
        is(CITY, 'Jakarta'),
        isNot(SALES_FIELD, 'Andi'),
      ]),
      total('Berapa penjualan semua produk kecuali Honda?', [isNot(PRODUCT, 'Honda')]),
      total('Berapa penjualan Andi selain di Jakarta?', [is(SALES_FIELD, 'Andi'), isNot(CITY, 'Jakarta')]),
      total('Berapa penjualan Honda di Surabaya tanpa Budi?', [
        is(PRODUCT, 'Honda'),
        is(CITY, 'Surabaya'),
        isNot(SALES_FIELD, 'Budi'),
      ]),
    ],
  },
];
