export class Field {
  constructor(key, label, type) {
    this.key = key;
    this.label = label;
    this.type = type;
  }
}

export class Dimension extends Field {
  constructor(key, label, table, column, type = 'text', foreignKey = null) {
    super(key, label, type);
    this.table = table;
    this.column = column;
    // Kolom foreign key di tabel sumber, dipakai untuk membangun JOIN.
    this.foreignKey = foreignKey;
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

// Tabel sumber laporan. Nama kolom, key, dan label field TIDAK ditulis di sini:
// strukturnya dibaca dari information_schema, labelnya dari tabel `field_catalog`,
// sehingga dataset lain cukup mengisi katalognya.
export const ROOT_TABLE = 'sales';
export const ROOT_ALIAS = 's';

// Kolom pembukuan tabel sumber yang bukan field laporan.
const BOOKKEEPING_COLUMNS = ['id', 'created_at'];

// Kolom yang dibaca dari tabel relasi bila katalog tidak menyebutkannya.
const DEFAULT_REFERENCE_COLUMN = 'name';

// Agregasi adalah definisi operasi: label + SQL jadi satu paket.
// - `columnLabel` (opsional) menentukan judul kolom pivot; tanpa itu "<label> <field>".
// - `defaultFor` menandai agregasi default untuk tipe field tertentu.
// - `hidden` berarti tidak ditawarkan di dropdown UI.
const AGGREGATIONS = new Map([
  ['sum', {
    label: 'Total',
    sql: (c) => `SUM(${c})`,
    allowedTypes: ['number'],
    defaultFor: ['number'],
  }],
  ['avg', { label: 'Rata-rata', sql: (c) => `AVG(${c})`, allowedTypes: ['number'] }],
  ['min', { label: 'Minimum', sql: (c) => `MIN(${c})`, allowedTypes: ['number'] }],
  ['max', { label: 'Maksimum', sql: (c) => `MAX(${c})`, allowedTypes: ['number'] }],
  ['count', {
    label: 'Jumlah Transaksi',
    sql: (c) => (c && c !== '*' ? `COUNT(${c})` : 'COUNT(*)'),
    allowedTypes: ['text', 'number'],
    columnLabel: () => 'Jumlah Transaksi',
    // Sementara tidak ditawarkan di dropdown; backend tetap mendukung COUNTIF.
    hidden: true,
  }],
  ['count_unique', {
    label: 'Jumlah',
    sql: (c) => `COUNT(DISTINCT ${c})`,
    allowedTypes: ['text', 'number'],
    columnLabel: (fieldLabel) => `Jumlah ${fieldLabel}`,
    defaultFor: ['text'],
    hidden: true,
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

// "salesperson_id" -> "salesperson"
const keyFromColumn = (column) => column.replace(/_id$/, '');

// "salesperson" -> "Salesperson". Hanya dipakai bila katalog tidak punya barisnya.
const labelFromColumn = (column) =>
  keyFromColumn(column)
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export class ReportSchema {
  constructor(pool = null) {
    this.pool = pool;
    this.dimensions = new Map();
    this.measures = new Map();
    this.aggregations = AGGREGATIONS;
    this.operators = OPERATORS;
    this.isLoaded = false;
  }

  // Membangun katalog field dari hasil introspeksi database. Dipakai oleh
  // loadFromDatabase() dan oleh tes, jadi logikanya tidak bergantung pada DB.
  loadFromIntrospection({ foreignKeys = [], columns = [], catalog = [] }) {
    const catalogBySource = new Map(catalog.map((row) => [row.source_column, row]));
    const foreignKeyColumns = new Set(foreignKeys.map((row) => row.column_name));

    const metaFor = (sourceColumn) => {
      const entry = catalogBySource.get(sourceColumn);
      return {
        key: entry?.field_key ?? keyFromColumn(sourceColumn),
        label: entry?.label ?? labelFromColumn(sourceColumn),
        referenceColumn: entry?.reference_column ?? DEFAULT_REFERENCE_COLUMN,
      };
    };

    const register = (dimension) => {
      this.dimensions.set(dimension.key, dimension);
      this.measures.set(
        dimension.key,
        new Measure(dimension.key, dimension.label, dimension.getColumnSql(), dimension.type),
      );
    };

    this.dimensions.clear();
    this.measures.clear();

    for (const row of foreignKeys) {
      const meta = metaFor(row.column_name);
      register(
        new Dimension(
          meta.key,
          meta.label,
          row.foreign_table,
          meta.referenceColumn,
          'text',
          row.column_name,
        ),
      );
    }

    for (const row of columns) {
      if (BOOKKEEPING_COLUMNS.includes(row.column_name)) continue;
      if (foreignKeyColumns.has(row.column_name)) continue;

      const type = NUMERIC_TYPES.includes(row.data_type) ? 'number' : 'text';
      const meta = metaFor(row.column_name);
      register(new Dimension(meta.key, meta.label, null, `${ROOT_ALIAS}.${row.column_name}`, type));
    }
  }

  async loadFromDatabase() {
    if (this.isLoaded || !this.pool) return;

    try {
      const [foreignKeys, columns, catalog] = await Promise.all([
        this._loadForeignKeys(),
        this._loadColumns(),
        this._loadCatalog(),
      ]);
      this.loadFromIntrospection({ foreignKeys, columns, catalog });
      this.isLoaded = true;
    } catch (err) {
      console.warn('[ReportSchema] Database schema introspection failed:', err.message);
    }
  }

  async _loadForeignKeys() {
    const { rows } = await this.pool.query(
      `SELECT
         kcu.column_name,
         ccu.table_name AS foreign_table
       FROM information_schema.table_constraints AS tc
       JOIN information_schema.key_column_usage AS kcu
         ON tc.constraint_name = kcu.constraint_name
       JOIN information_schema.constraint_column_usage AS ccu
         ON ccu.constraint_name = tc.constraint_name
       WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1`,
      [ROOT_TABLE],
    );
    return rows;
  }

  async _loadColumns() {
    const { rows } = await this.pool.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = $1`,
      [ROOT_TABLE],
    );
    return rows;
  }

  // Katalog field bersifat data: bila tabelnya tidak ada, key & label field
  // diturunkan dari nama kolom sehingga aplikasi tetap jalan.
  async _loadCatalog() {
    try {
      const { rows } = await this.pool.query(
        'SELECT source_column, field_key, label, reference_column FROM field_catalog',
      );
      return rows;
    } catch (err) {
      console.warn('[ReportSchema] field_catalog tidak terbaca, memakai key/label turunan:', err.message);
      return [];
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
