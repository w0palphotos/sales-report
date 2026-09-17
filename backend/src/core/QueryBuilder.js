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

export class QueryBuilder {
  constructor(schema) {
    this.schema = schema;
  }

  coerceValue(field, value) {
    const type = this.schema.getMeasure(field)?.type ?? this.schema.getDimension(field)?.type;
    if (type === 'number') {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        throw new ValidationError(`Nilai filter tidak valid: ${value}`);
      }
      return number;
    }
    return String(value);
  }

  validateConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new ValidationError('Konfigurasi laporan harus berupa objek.');
    }

    const { rows = [], columns = [], values = [], filters = [] } = config;

    if (![rows, columns, values, filters].every(Array.isArray)) {
      throw new ValidationError('rows, columns, values, dan filters harus berupa array.');
    }
    if (rows.length === 0 && columns.length === 0 && values.length === 0) {
      throw new ValidationError('Pilih minimal satu baris, kolom, atau nilai.');
    }
    if (rows.length > 3) throw new ValidationError('Maksimal tiga field baris.');
    if (columns.length > 1) throw new ValidationError('Maksimal satu field sebagai kolom.');
    if (values.length > 3) throw new ValidationError('Maksimal tiga nilai.');

    for (const key of rows) {
      if (!this.schema.getDimension(key)) {
        throw new ValidationError(`Field baris tidak dikenal: ${key}`);
      }
    }
    for (const key of columns) {
      if (!this.schema.getDimension(key)) {
        throw new ValidationError(`Field kolom tidak dikenal: ${key}`);
      }
    }

    const used = new Set([...rows, ...columns]);
    if (used.size !== rows.length + columns.length) {
      throw new ValidationError('Sebuah field tidak boleh dipakai di baris sekaligus kolom.');
    }

    for (const item of values) {
      if (!item || typeof item !== 'object') {
        throw new ValidationError('Setiap nilai harus berupa objek.');
      }
      const measure = this.schema.getMeasure(item.field);
      if (!measure) {
        throw new ValidationError(`Field nilai tidak dikenal: ${item.field}`);
      }
      const agg = this.schema.getAggregation(item.aggregation);
      if (!agg) {
        throw new ValidationError(`Perhitungan tidak dikenal: ${item.aggregation}`);
      }
      if (agg.allowedTypes && !agg.allowedTypes.includes(measure.type)) {
        throw new ValidationError(
          `Perhitungan "${item.aggregation}" tidak berlaku untuk field "${item.field}" (${measure.type}).`,
        );
      }
    }

    for (const filter of filters) {
      if (!filter || typeof filter !== 'object') {
        throw new ValidationError('Setiap filter harus berupa objek.');
      }
      const measure = this.schema.getMeasure(filter.field);
      const dimension = this.schema.getDimension(filter.field);
      if (!measure && !dimension) {
        throw new ValidationError(`Field filter tidak dikenal: ${filter.field}`);
      }

      const operator = this.schema.getOperator(filter.operator);
      if (!operator) {
        throw new ValidationError(`Operator tidak dikenal: ${filter.operator}`);
      }

      const type = measure ? measure.type : dimension.type;
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

  build(config) {
    this.validateConfig(config);

    const { rows = [], columns = [], values = [], filters = [] } = config;

    const params = [];
    const joins = new Set();
    const wantJoin = (field) => {
      const table = this.schema.getDimension(field)?.table;
      if (table) joins.add(table);
    };

    rows.forEach(wantJoin);
    columns.forEach(wantJoin);
    values.forEach((v) => wantJoin(v.field));
    filters.forEach((filter) => wantJoin(filter.field));

    const joinsSql = [...joins].map((table) => `JOIN ${table} ON s.${FK_BY_TABLE[table]} = ${table}.id`);

    const select = [
      ...rows.map((key, i) => `${this.schema.getDimensionColumn(key)} AS "_r${i}"`),
      ...(columns.length ? [`${this.schema.getDimensionColumn(columns[0])} AS "_c"`] : []),
      ...values.map(
        (value, i) =>
          `${this.schema.getAggregation(value.aggregation).sql(this.schema.getMeasure(value.field)?.column || this.schema.getDimensionColumn(value.field))} AS "_v${i}"`,
      ),
    ];

    const groupDimensions = [
      ...rows.map((key) => this.schema.getDimensionColumn(key)),
      ...(columns.length ? [this.schema.getDimensionColumn(columns[0])] : []),
    ];

    const rawSets = columns.length
      ? [
          `(${groupDimensions.join(', ')})`,
          `(${rows.map((key) => this.schema.getDimensionColumn(key)).join(', ')})`,
          `(${this.schema.getDimensionColumn(columns[0])})`,
          '()',
        ]
      : [`(${rows.map((key) => this.schema.getDimensionColumn(key)).join(', ')})`, '()'];

    const groupingSets = Array.from(new Set(rawSets.filter((s) => s !== '()')));
    groupingSets.push('()');

    const where = [];
    for (const filter of filters) {
      const column = this.schema.getMeasure(filter.field)?.column || this.schema.getDimensionColumn(filter.field);
      const operator = this.schema.getOperator(filter.operator);

      if (filter.operator === 'between') {
        const [min, max] = filter.value;
        const p1 = params.length + 1;
        const p2 = params.length + 2;
        params.push(this.coerceValue(filter.field, min), this.coerceValue(filter.field, max));
        where.push(`${column} BETWEEN $${p1} AND $${p2}`);
      } else if (filter.operator === 'contains') {
        const p = params.length + 1;
        params.push(`%${String(filter.value)}%`);
        where.push(`${column} ILIKE $${p}`);
      } else {
        const p = params.length + 1;
        params.push(this.coerceValue(filter.field, filter.value));
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
      orderBy.length ? `ORDER BY ${orderBy.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return { sql, params };
  }
}
