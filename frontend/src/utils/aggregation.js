// Aturan agregasi di UI. Definisinya datang dari backend (`meta.aggregations`),
// jadi daftar di sini tidak perlu dirawat ulang saat agregasi berubah:
//   - `defaultFor` = agregasi default untuk tipe field tertentu (mis. teks -> Jumlah)
//   - `hidden`     = dipakai otomatis, tidak ditawarkan di dropdown

// Agregasi hitung menghasilkan cacah (bilangan bulat), bukan nominal rupiah.
const COUNT_AGGREGATIONS = new Set(['count', 'count_unique']);

export const isCountAggregation = (aggregation) => COUNT_AGGREGATIONS.has(aggregation);

export const isAggregationAllowed = (aggregations, key, fieldType) => {
  const definition = aggregations.find((aggregation) => aggregation.key === key);
  return Boolean(definition) && (!definition.allowedTypes || definition.allowedTypes.includes(fieldType));
};

export const defaultAggregationFor = (aggregations, fieldType) =>
  aggregations.find((aggregation) => aggregation.defaultFor?.includes(fieldType))?.key ??
  aggregations[0]?.key ??
  '';
