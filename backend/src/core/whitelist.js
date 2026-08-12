export const DIMENSIONS = {
  sales_name: { label: 'Nama Sales', table: 'salespeople', column: 'name', type: 'text' },
  city: { label: 'Kota', table: 'cities', column: 'name', type: 'text' },
  product: { label: 'Produk', table: 'products', column: 'name', type: 'text' },
};

export const MEASURES = {
  amount: { label: 'Penjualan', column: 's.amount', type: 'number' },
};

export const AGGREGATIONS = {
  sum: { label: 'Total', sql: (column) => `SUM(${column})` },
  avg: { label: 'Rata-rata', sql: (column) => `AVG(${column})` },
  count: { label: 'Jumlah Transaksi', sql: () => 'COUNT(*)' },
};

export const OPERATORS = {
  '=': { label: 'Sama dengan', symbol: '=', argCount: 1 },
  '!=': { label: 'Tidak sama dengan', symbol: '<>', argCount: 1 },
  '>': { label: 'Lebih dari', symbol: '>', argCount: 1 },
  '<': { label: 'Kurang dari', symbol: '<', argCount: 1 },
  '>=': { label: 'Lebih dari atau sama dengan', symbol: '>=', argCount: 1 },
  '<=': { label: 'Kurang dari atau sama dengan', symbol: '<=', argCount: 1 },
  contains: { label: 'Mengandung', textOnly: true, argCount: 1 },
  between: { label: 'Di antara', numberOnly: true, argCount: 2 },
};

export const dimensionColumn = (key) => `${DIMENSIONS[key].table}.${DIMENSIONS[key].column}`;
