import { DIMENSIONS, MEASURES, AGGREGATIONS, OPERATORS, dimensionColumn } from './whitelist.js';

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

const FK_BY_TABLE = {
  salespeople: 'salesperson_id',
  cities: 'city_id',
  products: 'product_id',
};

function coerceValue(field, value) {
  const measure = MEASURES[field];
  if (measure?.type === 'number') {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new ValidationError(`Nilai filter tidak valid: ${value}`);
    return number;
  }
  return String(value);
}

export function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new ValidationError('Konfigurasi laporan harus berupa objek.');
  }

  const { rows = [], columns = [], values = [], filters = [] } = config;

  if (![rows, columns, values, filters].every(Array.isArray)) {
    throw new ValidationError('rows, columns, values, dan filters harus berupa array.');
  }
  if (rows.length < 1) throw new ValidationError('Minimal pilih satu field sebagai baris.');
  if (rows.length > 3) throw new ValidationError('Maksimal tiga field baris.');
  if (columns.length > 1) throw new ValidationError('Maksimal satu field sebagai kolom.');
  if (values.length < 1) throw new ValidationError('Minimal pilih satu nilai.');
  if (values.length > 3) throw new ValidationError('Maksimal tiga nilai.');

  for (const key of rows) {
    if (!(key in DIMENSIONS)) throw new ValidationError(`Field baris tidak dikenal: ${key}`);
  }
  for (const key of columns) {
    if (!(key in DIMENSIONS)) throw new ValidationError(`Field kolom tidak dikenal: ${key}`);
  }

  const used = new Set([...rows, ...columns]);
  if (used.size !== rows.length + columns.length) {
    throw new ValidationError('Sebuah field tidak boleh dipakai di baris sekaligus kolom.');
  }

  for (const item of values) {
    if (!item || typeof item !== 'object') throw new ValidationError('Setiap nilai harus berupa objek.');
    if (!(item.field in MEASURES)) throw new ValidationError(`Field nilai tidak dikenal: ${item.field}`);
    if (!(item.aggregation in AGGREGATIONS)) {
      throw new ValidationError(`Perhitungan tidak dikenal: ${item.aggregation}`);
    }
  }

  for (const filter of filters) {
    if (!filter || typeof filter !== 'object') throw new ValidationError('Setiap filter harus berupa objek.');
    const isMeasure = filter.field in MEASURES;
    const isDimension = filter.field in DIMENSIONS;
    if (!isMeasure && !isDimension) throw new ValidationError(`Field filter tidak dikenal: ${filter.field}`);

    const operator = OPERATORS[filter.operator];
    if (!operator) throw new ValidationError(`Operator tidak dikenal: ${filter.operator}`);

    const type = isMeasure ? MEASURES[filter.field].type : DIMENSIONS[filter.field].type;
    if (operator.textOnly && type !== 'text') {
      throw new ValidationError(`Operator "${filter.operator}" hanya berlaku untuk field teks.`);
    }
    if (operator.numberOnly && type !== 'number') {
      throw new ValidationError(`Operator "${filter.operator}" hanya berlaku untuk field angka.`);
    }

    if (filter.operator === 'between') {
      if (!Array.isArray(filter.value) || filter.value.length !== 2) {
        throw new ValidationError('Operator "between" membutuhkan dua nilai (min dan max).');
      }
    } else if (filter.value === undefined || filter.value === null || filter.value === '') {
      throw new ValidationError(`Filter "${filter.field}" membutuhkan nilai.`);
    }
  }
}

export function buildReportQuery(config) {
  validateConfig(config);

  const { rows, columns, values, filters = [] } = config;

  const params = [];
  const joins = new Set();
  const wantJoin = (field) => {
    if (field in DIMENSIONS) joins.add(DIMENSIONS[field].table);
  };

  rows.forEach(wantJoin);
  columns.forEach(wantJoin);
  filters.forEach((filter) => wantJoin(filter.field));

  const joinsSql = [...joins].map((table) => `JOIN ${table} ON s.${FK_BY_TABLE[table]} = ${table}.id`);

  const select = [
    ...rows.map((key, i) => `${dimensionColumn(key)} AS "_r${i}"`),
    ...(columns.length ? [`${dimensionColumn(columns[0])} AS "_c"`] : []),
    ...values.map((value, i) => `${AGGREGATIONS[value.aggregation].sql(MEASURES[value.field].column)} AS "_v${i}"`),
  ];

  const groupDimensions = [
    ...rows.map(dimensionColumn),
    ...(columns.length ? [dimensionColumn(columns[0])] : []),
  ];

  const groupingSets = columns.length
    ? [`(${groupDimensions.join(', ')})`, `(${rows.map(dimensionColumn).join(', ')})`, `(${dimensionColumn(columns[0])})`, '()']
    : [`(${rows.map(dimensionColumn).join(', ')})`, '()'];

  const where = [];
  for (const filter of filters) {
    const column = filter.field in MEASURES
      ? MEASURES[filter.field].column
      : dimensionColumn(filter.field);
    const operator = OPERATORS[filter.operator];

    if (filter.operator === 'between') {
      const [min, max] = filter.value;
      const p1 = params.length + 1;
      const p2 = params.length + 2;
      params.push(coerceValue(filter.field, min), coerceValue(filter.field, max));
      where.push(`${column} BETWEEN $${p1} AND $${p2}`);
    } else if (filter.operator === 'contains') {
      const p = params.length + 1;
      params.push(`%${String(filter.value)}%`);
      where.push(`${column} ILIKE $${p}`);
    } else {
      const p = params.length + 1;
      params.push(coerceValue(filter.field, filter.value));
      where.push(`${column} ${operator.symbol} $${p}`);
    }
  }

  const orderBy = [
    ...rows.map((_, i) => `"_r${i}" ASC`),
    ...(columns.length ? ['"_c" ASC'] : []),
  ];

  const sql = [
    `SELECT ${select.join(', ')}`,
    'FROM sales s',
    ...joinsSql,
    where.length ? `WHERE ${where.join(' AND ')}` : '',
    `GROUP BY GROUPING SETS (${groupingSets.join(', ')})`,
    `ORDER BY ${orderBy.join(', ')}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { sql, params };
}
