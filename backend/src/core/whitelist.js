export const DIMENSIONS = {
  sales_name: { label: 'Nama Sales', table: 'salespeople', column: 'name', type: 'text' },
  city: { label: 'Kota', table: 'cities', column: 'name', type: 'text' },
  product: { label: 'Produk', table: 'products', column: 'name', type: 'text' },
  amount: { label: 'Penjualan', table: null, column: 's.amount', type: 'number' },
};

export const MEASURES = {
  amount: { label: 'Penjualan', column: 's.amount', type: 'number' },
  sales_name: { label: 'Nama Sales', column: 'salespeople.name', type: 'text' },
  city: { label: 'Kota', column: 'cities.name', type: 'text' },
  product: { label: 'Produk', column: 'products.name', type: 'text' },
};

export const AGGREGATIONS = {
  sum: { label: 'Total', sql: (column) => `SUM(${column})`, allowedTypes: ['number'] },
  avg: { label: 'Rata-rata', sql: (column) => `AVG(${column})`, allowedTypes: ['number'] },
  count: { label: 'Jumlah Transaksi', sql: (column) => (column && column !== '*' ? `COUNT(${column})` : 'COUNT(*)'), allowedTypes: ['text', 'number'] },
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

export const dimensionColumn = (key) => {
  const dim = DIMENSIONS[key];
  if (!dim) return key;
  return dim.table ? `${dim.table}.${dim.column}` : dim.column;
};
