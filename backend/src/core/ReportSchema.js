export class Field {
  constructor(key, label, type) {
    this.key = key;
    this.label = label;
    this.type = type;
  }
}

export class Dimension extends Field {
  constructor(key, label, table, column, type = 'text') {
    super(key, label, type);
    this.table = table;
    this.column = column;
  }

  getColumnSql() {
    return this.table ? `${this.table}.${this.column}` : this.column;
  }
}

export class Measure extends Field {
  constructor(key, label, column, type = 'number') {
    super(key, label, type);
    this.column = column;
  }
}

const AGGREGATIONS = new Map([
  ['sum', { label: 'Total', sql: (c) => `SUM(${c})`, allowedTypes: ['number'] }],
  ['avg', { label: 'Rata-rata', sql: (c) => `AVG(${c})`, allowedTypes: ['number'] }],
  ['count', {
    label: 'Jumlah Transaksi',
    sql: (c) => (c && c !== '*' ? `COUNT(${c})` : 'COUNT(*)'),
    allowedTypes: ['text', 'number'],
  }],
]);

const OPERATORS = new Map([
  ['=', { label: 'Sama dengan', symbol: '=', argCount: 1 }],
  ['!=', { label: 'Tidak sama dengan', symbol: '<>', argCount: 1 }],
  ['>', { label: 'Lebih dari', symbol: '>', argCount: 1 }],
  ['<', { label: 'Kurang dari', symbol: '<', argCount: 1 }],
  ['>=', { label: 'Lebih dari atau sama dengan', symbol: '>=', argCount: 1 }],
  ['<=', { label: 'Kurang dari atau sama dengan', symbol: '<=', argCount: 1 }],
  ['contains', { label: 'Mengandung', textOnly: true, argCount: 1 }],
  ['between', { label: 'Di antara', numberOnly: true, argCount: 2 }],
]);

const NUMERIC_TYPES = ['numeric', 'integer', 'bigint', 'double precision', 'real'];

const DEFAULT_LABELS = {
  salesperson_id: { key: 'sales_name', label: 'Nama Sales' },
  city_id: { key: 'city', label: 'Kota' },
  product_id: { key: 'product', label: 'Produk' },
  amount: { key: 'amount', label: 'Penjualan' },
};

export class ReportSchema {
  constructor(pool = null) {
    this.pool = pool;
    this.dimensions = new Map();
    this.measures = new Map();
    this.aggregations = AGGREGATIONS;
    this.operators = OPERATORS;
    this.isLoaded = false;

    this._setupDefaultFields();
  }

  _setupDefaultFields() {
    this.dimensions.set('sales_name', new Dimension('sales_name', 'Nama Sales', 'salespeople', 'name', 'text'));
    this.dimensions.set('city', new Dimension('city', 'Kota', 'cities', 'name', 'text'));
    this.dimensions.set('product', new Dimension('product', 'Produk', 'products', 'name', 'text'));
    this.dimensions.set('amount', new Dimension('amount', 'Penjualan', null, 's.amount', 'number'));

    this.measures.set('amount', new Measure('amount', 'Penjualan', 's.amount', 'number'));
    this.measures.set('sales_name', new Measure('sales_name', 'Nama Sales', 'salespeople.name', 'text'));
    this.measures.set('city', new Measure('city', 'Kota', 'cities.name', 'text'));
    this.measures.set('product', new Measure('product', 'Produk', 'products.name', 'text'));
  }

  async loadFromDatabase() {
    if (this.isLoaded || !this.pool) return;

    try {
      const fkRes = await this.pool.query(`
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'sales';
      `);

      const colRes = await this.pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'sales' AND column_name NOT IN ('id', 'created_at');
      `);

      if (fkRes.rows.length > 0 || colRes.rows.length > 0) {
        this.dimensions.clear();
        this.measures.clear();

        for (const row of fkRes.rows) {
          const colName = row.column_name;
          const meta = DEFAULT_LABELS[colName] ?? { key: colName.replace(/_id$/, ''), label: colName };
          const dim = new Dimension(meta.key, meta.label, row.foreign_table, 'name', 'text');
          this.dimensions.set(meta.key, dim);
          this.measures.set(meta.key, new Measure(meta.key, meta.label, dim.getColumnSql(), 'text'));
        }

        for (const row of colRes.rows) {
          const colName = row.column_name;
          if (colName.endsWith('_id')) continue;

          const type = NUMERIC_TYPES.includes(row.data_type) ? 'number' : 'text';
          const meta = DEFAULT_LABELS[colName] ?? { key: colName, label: colName };
          const dim = new Dimension(meta.key, meta.label, null, `s.${colName}`, type);
          this.dimensions.set(meta.key, dim);
          this.measures.set(meta.key, new Measure(meta.key, meta.label, `s.${colName}`, type));
        }
      }

      this.isLoaded = true;
    } catch (err) {
      // Fallback: default schema from constructor stays active
      console.warn('[ReportSchema] Database schema introspection failed, using default schema:', err.message);
    }
  }

  getDimensionColumn(key) {
    const dim = this.dimensions.get(key);
    return dim ? dim.getColumnSql() : key;
  }

  getDimension(key) {
    return this.dimensions.get(key);
  }

  getMeasure(key) {
    return this.measures.get(key);
  }

  getAggregation(key) {
    return this.aggregations.get(key);
  }

  getOperator(key) {
    return this.operators.get(key);
  }
}
