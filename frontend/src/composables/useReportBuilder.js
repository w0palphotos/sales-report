import { reactive, ref, computed } from 'vue';
import { api } from '../api/client.js';

export function useReportBuilder() {
  const meta = ref(null);
  const loading = ref(false);
  const running = ref(false);
  const error = ref(null);
  const result = ref(null);
  const savedReports = ref([]);

  const config = reactive({
    rows: ['sales_name'],
    columns: [],
    values: [{ field: 'amount', aggregation: 'sum' }],
    filters: [],
  });

  const canRun = computed(() => config.rows.length >= 1 && config.values.length >= 1);

  const usedRowFields = computed(() => new Set([...config.rows, ...config.columns]));

  const availableDimensions = computed(() =>
    (meta.value?.dimensions ?? []).filter((dimension) => !usedRowFields.value.has(dimension.key)),
  );

  const configToPayload = () => ({
    rows: [...config.rows],
    columns: [...config.columns],
    values: config.values.map((value) => ({ field: value.field, aggregation: value.aggregation })),
    filters: config.filters
      .filter((filter) => filter.field && filter.operator && hasValidValue(filter))
      .map((filter) => ({ ...filter, value: Array.isArray(filter.value) ? [...filter.value] : filter.value })),
  });

  const hasValidValue = (filter) => {
    if (Array.isArray(filter.value)) return filter.value.every((item) => item !== '' && item != null);
    return filter.value !== '' && filter.value != null;
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

  async function run() {
    if (!canRun.value) {
      error.value = 'Pilih minimal satu baris dan satu nilai.';
      return;
    }
    running.value = true;
    error.value = null;
    try {
      result.value = await api.runReport(configToPayload());
    } catch (err) {
      error.value = err.message;
    } finally {
      running.value = false;
    }
  }

  async function downloadCsv() {
    try {
      const blob = await api.exportCsv(configToPayload());
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'laporan.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      error.value = err.message;
    }
  }

  function reset() {
    config.rows = ['sales_name'];
    config.columns = [];
    config.values = [{ field: 'amount', aggregation: 'sum' }];
    config.filters = [];
    result.value = null;
    error.value = null;
  }

  function addRow() {
    if (config.rows.length >= 3) return;
    const next = availableDimensions.value[0];
    if (next) config.rows.push(next.key);
  }

  function setRow(index, key) {
    config.rows[index] = key;
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
    if (config.values.length >= 3) return;
    config.values.push({ field: 'amount', aggregation: 'sum' });
  }

  function updateValue(index, patch) {
    Object.assign(config.values[index], patch);
  }

  function removeValue(index) {
    config.values.splice(index, 1);
  }

  function addFilter() {
    config.filters.push({ field: '', operator: '', value: '' });
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
    Object.assign(config, {
      rows: report.config.rows ?? [],
      columns: report.config.columns ?? [],
      values: report.config.values ?? [],
      filters: report.config.filters ?? [],
    });
    result.value = null;
    error.value = null;
  }

  async function deleteSaved(id) {
    try {
      await api.saved.remove(id);
      await refreshSaved();
    } catch (err) {
      error.value = err.message;
    }
  }

  return {
    meta,
    loading,
    running,
    error,
    result,
    savedReports,
    config,
    canRun,
    availableDimensions,
    loadMeta,
    refreshSaved,
    run,
    downloadCsv,
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
    saveReport,
    loadReport,
    deleteSaved,
  };
}
