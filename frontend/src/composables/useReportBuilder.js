import { reactive, ref, computed, watch } from 'vue';
import { api } from '../api/client.js';
import { buildXlsxBuffer } from '../utils/xlsxExport.js';
import { tableStylesToMap, styleKey } from '../utils/cellStyle.js';
import { presetOwnedKeys, normalizePreset } from '../utils/tablePresets.js';
import { defaultAggregationFor, isAggregationAllowed } from '../utils/aggregation.js';

const clone = (value) => JSON.parse(JSON.stringify(value ?? {}));

const hasValidValue = (filter) => {
  if (Array.isArray(filter.value)) return filter.value.every((item) => item !== '' && item != null);
  return filter.value !== '' && filter.value != null;
};

function toColorMap(list) {
  const map = {};
  for (const item of list ?? []) {
    if (!item || !item.field || item.value == null) continue;
    if (!map[item.field]) map[item.field] = {};
    map[item.field][String(item.value)] = { bg: item.bg, color: item.color ?? '#2f3437' };
  }
  return map;
}

// Normalisasi config laporan tersimpan (lama/baru) ke bentuk state kini.
function normalizeSavedConfig(rawConfig, metaData) {
  const config = rawConfig ?? {};

  // Pastikan agregasi valid untuk tipe datanya: kalau tidak, pakai default tipe itu
  // (angka -> Total, teks -> Jumlah).
  const aggregations = metaData?.aggregations ?? [];
  const values = (config.values ?? []).map((v) => {
    const measure = (metaData?.measures ?? []).find((m) => m.key === v.field);

    let aggregation = v.aggregation;
    if (measure && !isAggregationAllowed(aggregations, aggregation, measure.type)) {
      aggregation = defaultAggregationFor(aggregations, measure.type);
    }
    return { field: v.field, aggregation };
  });

  return {
    rows: config.rows ?? [],
    columns: config.columns ?? [],
    values: values,
    // Laporan lama tanpa operator dianggap '='; nilai 'between' (array) disatukan.
    filters: (config.filters ?? []).map((filter) => ({
      field: filter.field ?? '',
      operator: filter.operator ?? '=',
      value: Array.isArray(filter.value) ? (filter.value[0] ?? '') : (filter.value ?? ''),
    })),
    colors:
      config.colors && typeof config.colors === 'object' ? clone(config.colors) : {},
    styles:
      config.styles && typeof config.styles === 'object' ? clone(config.styles) : {},
    preset: normalizePreset(config.preset),
  };
}

export function useReportBuilder() {
  const meta = ref(null);
  const loading = ref(false);
  const running = ref(false);
  const error = ref(null);
  const result = ref(null);
  const savedReports = ref([]);

  const MAX_VALUES = 8;

  const config = reactive({
    rows: [],
    columns: [],
    values: [],
    filters: [],
    colors: {},
    styles: {},
    preset: null,
  });

  const globalColors = ref({});
  const tableStyles = ref({});

  const canRun = computed(() => config.rows.length + config.columns.length + config.values.length > 0);

  const usedRowFields = computed(() => new Set([...config.rows, ...config.columns]));

  const availableDimensions = computed(() =>
    (meta.value?.dimensions ?? []).filter((dimension) => !usedRowFields.value.has(dimension.key)),
  );

  // Operator filter dikirim apa adanya (default '=').
  const configToPayload = () => ({
    rows: [...config.rows],
    columns: [...config.columns],
    values: config.values.map((value) => ({ field: value.field, aggregation: value.aggregation })),
    filters: config.filters
      .filter((filter) => filter.field && hasValidValue(filter))
      .map((filter) => ({
        field: filter.field,
        operator: filter.operator ?? '=',
        value: Array.isArray(filter.value) ? (filter.value[0] ?? '') : filter.value,
      })),
    colors: clone(config.colors),
    styles: clone(config.styles),
    preset: config.preset ?? null,
  });

  // Payload bersih untuk backend: tanpa colors/styles/preset (hanya urusan tampil),
  // agar ubah warna laporan tidak memicu fetch sia-sia.
  const backendPayload = () => {
    const payload = configToPayload();
    delete payload.colors;
    delete payload.styles;
    delete payload.preset;
    return payload;
  };

  async function loadMeta() {
    loading.value = true;
    try {
      meta.value = await api.getMeta();
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  }

  async function refreshSaved() {
    try {
      const data = await api.saved.list();
      savedReports.value = data.reports;
    } catch (err) {
      error.value = err.message;
    }
  }

  let lastPayloadJson = null;

  async function run() {
    if (!canRun.value) {
      result.value = null;
      lastPayloadJson = null;
      return;
    }
    running.value = true;
    error.value = null;
    try {
      const payload = backendPayload();
      lastPayloadJson = JSON.stringify(payload);
      result.value = await api.runReport(payload);
    } catch (err) {
      error.value = err.message;
    } finally {
      running.value = false;
    }
  }

  async function downloadXlsx(overrideReport, colors = {}, tableStyles = {}, filename = null) {
    const reportData = overrideReport ?? result.value;
    if (!reportData) {
      error.value = 'Belum ada laporan untuk diexport.';
      return;
    }
    try {
      // ponytail: export formatted pivot + native editable OpenXML chart to xlsx
      const blob = await buildXlsxBuffer(reportData, colors, tableStyles);
      const date = new Date().toISOString().slice(0, 10);
      const safe = String(filename ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = safe ? `${safe}-${date}.xlsx` : `laporan-${date}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      error.value = err.message || 'Export XLSX gagal.';
    }
  }

  function reset() {
    config.rows = [];
    config.columns = [];
    config.values = [];
    config.filters = [];
    config.colors = {};
    config.styles = {};
    config.preset = null;
    result.value = null;
    error.value = null;
    lastPayloadJson = null;
  }

  function addRow() {
    if (config.rows.length >= 3) return;
    const next = availableDimensions.value[0];
    if (next) config.rows.push(next.key);
  }

  function setRow(index, key) {
    if (!key) {
      removeRow(index);
    } else {
      config.rows[index] = key;
    }
  }

  function removeRow(index) {
    config.rows.splice(index, 1);
  }

  function setColumn(key) {
    config.columns = [key];
  }

  function clearColumn() {
    config.columns = [];
  }

  function addValue() {
    if (config.values.length >= MAX_VALUES) return;
    const measure = meta.value?.measures?.[0];
    const field = measure?.key || 'amount';
    const aggregation = defaultAggregationFor(meta.value?.aggregations ?? [], measure?.type || 'number');
    // avoid duplicate same field+aggregation
    if (config.values.some((v) => v.field === field && v.aggregation === aggregation)) return;
    config.values.push({ field, aggregation });
  }

  // Saat field nilai diganti, agregasi lama dipakai lagi hanya bila masih masuk akal
  // untuk tipe field baru; kalau tidak, pakai default tipe itu.
  function updateValue(index, patch) {
    const item = config.values[index];
    if (patch.field && patch.field !== item.field) {
      const aggregations = meta.value?.aggregations ?? [];
      const target = (meta.value?.measures ?? []).find((m) => m.key === patch.field);
      const current = patch.aggregation ?? item.aggregation;
      const stillUsable =
        aggregations.find((agg) => agg.key === current)?.hidden !== true &&
        isAggregationAllowed(aggregations, current, target?.type);

      if (!stillUsable) patch.aggregation = defaultAggregationFor(aggregations, target?.type);
    }
    Object.assign(item, patch);
  }

  function removeValue(index) {
    config.values.splice(index, 1);
  }

  function addFilter() {
    config.filters.push({ field: '', operator: '=', value: '' });
  }

  // Mengisi pivot dari pertanyaan bank pertanyaan (panel People also ask):
  // baris, nilai, dan filter diganti sekaligus agar pertanyaannya langsung terjawab.
  function applyQuestion(question) {
    config.rows = [...(question.rows ?? [])];
    config.columns = [];
    config.values = [{ field: question.field, aggregation: question.aggregation }];
    config.filters = (question.filters ?? []).map((filter) => ({
      field: filter.field,
      operator: filter.operator ?? '=',
      value: filter.value,
    }));
  }

  function updateFilter(index, patch) {
    Object.assign(config.filters[index], patch);
  }

  function removeFilter(index) {
    config.filters.splice(index, 1);
  }

  async function saveReport(name) {
    if (!name || !name.trim()) {
      error.value = 'Isi nama laporan.';
      return false;
    }
    if (!canRun.value) {
      error.value = 'Konfigurasi laporan belum lengkap.';
      return false;
    }
    try {
      await api.saved.create({ name: name.trim(), config: configToPayload() });
      await refreshSaved();
      return true;
    } catch (err) {
      error.value = err.message;
      return false;
    }
  }

  function loadReport(report) {
    Object.assign(config, normalizeSavedConfig(report.config, meta.value));
    result.value = null;
    error.value = null;
  }

  async function loadColors() {
    try {
      const data = await api.colors.list();
      globalColors.value = toColorMap(data?.colors);
    } catch (err) {
      console.warn('Gagal memuat warna kategori:', err.message);
    }
  }

  async function saveGlobalColors(colors) {
    try {
      const data = await api.colors.save(colors);
      globalColors.value = toColorMap(data?.colors);
      return true;
    } catch (err) {
      error.value = err.message;
      return false;
    }
  }

  async function loadTableStyles() {
    try {
      const data = await api.tableStyles.list();
      tableStyles.value = tableStylesToMap(data?.styles);
    } catch (err) {
      console.warn('Gagal memuat gaya tabel:', err.message);
    }
  }

  async function saveGlobalTableStyles(styles) {
    try {
      const data = await api.tableStyles.save(styles);
      tableStyles.value = tableStylesToMap(data?.styles);
      return true;
    } catch (err) {
      error.value = err.message;
      return false;
    }
  }

  function setColorOverride(colors) {
    config.colors = JSON.parse(JSON.stringify(colors ?? {}));
  }

  function clearColorOverride() {
    config.colors = {};
  }

  function setTableStylesOverride(styles) {
    config.styles = JSON.parse(JSON.stringify(styles ?? {}));
  }

  function clearTableStylesOverride() {
    config.styles = {};
  }

  // Reset seluruh warna tabel: hapus override laporan ini dan aturan global,
  // sehingga tabel kembali ke warna default aplikasi.
  async function resetTableColors() {
    config.colors = {};
    config.styles = {};
    config.preset = null;
    await saveGlobalColors([]);
    await saveGlobalTableStyles([]);
  }

  // Terapkan preset warna tabel. Preset bisa berupa kunci bawaan atau objek
  // warna kustom, disimpan dan dihitung saat render sehingga baris/kolom baru
  // otomatis mengikuti. Aturan kolom lama milik preset dibersihkan.
  function applyTablePreset(preset) {
    const styles = clone(config.styles);
    const meta = result.value?.meta;
    if (meta) {
      for (const key of presetOwnedKeys(meta, result.value?.columnKeys ?? [])) {
        delete styles[styleKey('header', key)];
        delete styles[styleKey('column', key)];
      }
    }
    config.styles = styles;
    config.preset = normalizePreset(preset);
  }

  async function deleteSaved(id) {
    try {
      await api.saved.remove(id);
      await refreshSaved();
    } catch (err) {
      error.value = err.message;
    }
  }

  let runTimeout;
  watch(
    config,
    () => {
      if (canRun.value) {
        const nextPayloadJson = JSON.stringify(backendPayload());
        if (nextPayloadJson === lastPayloadJson) return;
        clearTimeout(runTimeout);
        runTimeout = setTimeout(() => {
          run();
        }, 250);
      } else {
        clearTimeout(runTimeout);
        result.value = null;
        lastPayloadJson = null;
      }
    },
    { deep: true },
  );

  return {
    meta,
    loading,
    running,
    error,
    result,
    savedReports,
    config,
    globalColors,
    tableStyles,
    canRun,
    availableDimensions,
    loadMeta,
    loadColors,
    saveGlobalColors,
    setColorOverride,
    clearColorOverride,
    loadTableStyles,
    saveGlobalTableStyles,
    setTableStylesOverride,
    clearTableStylesOverride,
    applyTablePreset,
    resetTableColors,
    refreshSaved,
    run,
    downloadXlsx,
    reset,
    addRow,
    setRow,
    removeRow,
    setColumn,
    clearColumn,
    addValue,
    updateValue,
    removeValue,
    addFilter,
    updateFilter,
    removeFilter,
    applyQuestion,
    saveReport,
    loadReport,
    deleteSaved,
  };
}
