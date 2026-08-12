<script setup>
import { computed, onMounted, ref } from 'vue';
import { useReportBuilder } from '../composables/useReportBuilder.js';
import FieldSelect from './FieldSelect.vue';
import ValueBuilder from './ValueBuilder.vue';
import FilterBuilder from './FilterBuilder.vue';
import ReportTable from './ReportTable.vue';
import BarChart from './BarChart.vue';
import SavedReports from './SavedReports.vue';

const {
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
} = useReportBuilder();

const reportName = ref('');

const dimensions = computed(() => meta.value?.dimensions ?? []);

const rowOptionsFor = (index) =>
  dimensions.value
    .filter((dimension) => {
      const used = new Set(config.rows.filter((_, j) => j !== index));
      config.columns.forEach((column) => used.add(column));
      return !used.has(dimension.key);
    })
    .map((dimension) => ({ value: dimension.key, label: dimension.label }));

const columnOptionsFor = () =>
  dimensions.value
    .filter((dimension) => {
      const used = new Set(config.rows);
      return !used.has(dimension.key) || dimension.key === config.columns[0];
    })
    .map((dimension) => ({ value: dimension.key, label: dimension.label }));

const isFilterFilled = (filter) => {
  if (!filter.field || !filter.operator) return false;
  if (Array.isArray(filter.value)) return filter.value.every((item) => item !== '' && item != null);
  return filter.value !== '' && filter.value != null;
};

const summary = computed(() => {
  if (!result.value) return '';
  const { rowFields, columnField, valueColumns } = result.value.meta;
  const parts = [];
  parts.push(`Baris: ${rowFields.map((field) => field.label).join(', ')}`);
  if (columnField) parts.push(`Kolom: ${columnField.label}`);
  parts.push(`Nilai: ${valueColumns.map((valueColumn) => valueColumn.label).join(', ')}`);
  const filterCount = config.filters.filter(isFilterFilled).length;
  if (filterCount > 0) parts.push(`Filter: ${filterCount}`);
  return parts.join('  ·  ');
});

async function handleSave() {
  const ok = await saveReport(reportName.value);
  if (ok) reportName.value = '';
}

function handleLoad(report) {
  loadReport(report);
  result.value = null;
}

onMounted(() => {
  loadMeta();
  refreshSaved();
});
</script>

<template>
  <header class="page-header">
    <div class="container">
      <div class="eyebrow">
        <span class="tag tag-ink">Dynamic Sales Insight</span>
      </div>
      <h1 class="page-title" v-reveal="0">Laporan penjualan yang bisa dibentuk sendiri.</h1>
      <p class="page-lead" v-reveal="1">
        Susun baris, kolom, nilai, dan filter untuk membangun laporan penjualan yang sesuai kebutuhan.
        Tanpa menulis query, tanpa halaman baru. Satu mesin, berbagai kombinasi.
      </p>
    </div>
  </header>

  <main class="builder-section">
    <div class="container builder-grid">
      <aside class="config-panel card" v-reveal="0">
        <h2 class="panel-title">Konfigurasi</h2>

        <div class="control-group">
          <div class="control-head">
            <span class="field-label">Baris</span>
            <button type="button" class="btn btn-ghost btn-small" :disabled="config.rows.length >= 3" @click="addRow">
              + Tambah
            </button>
          </div>
          <div v-for="(row, index) in config.rows" :key="index" class="row-entry">
            <FieldSelect
              :model-value="row"
              :options="rowOptionsFor(index)"
              placeholder="Pilih baris"
              @update:model-value="setRow(index, $event)"
            />
            <button type="button" class="btn-icon" :aria-label="`Hapus baris ${index + 1}`" @click="removeRow(index)">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <p v-if="config.rows.length === 0" class="hint">Pilih minimal satu baris untuk memulai.</p>
        </div>

        <div class="control-group">
          <div class="control-head">
            <span class="field-label">Kolom</span>
            <button v-if="config.columns.length" type="button" class="btn btn-ghost btn-small" @click="clearColumn">
              Bersihkan
            </button>
          </div>
          <div v-if="config.columns.length" class="row-entry">
            <FieldSelect
              :model-value="config.columns[0]"
              :options="columnOptionsFor()"
              placeholder="Pilih kolom"
              @update:model-value="setColumn($event)"
            />
          </div>
          <FieldSelect
            v-else
            model-value=""
            :options="columnOptionsFor()"
            placeholder="Tidak ada kolom"
            @update:model-value="setColumn($event)"
          />
        </div>

        <div class="control-group">
          <div class="control-head">
            <span class="field-label">Nilai</span>
            <button type="button" class="btn btn-ghost btn-small" :disabled="config.values.length >= 3" @click="addValue">
              + Tambah
            </button>
          </div>
          <ValueBuilder
            v-for="(value, index) in config.values"
            :key="index"
            :value="value"
            :meta="meta"
            :index="index"
            @update="updateValue(index, $event)"
            @remove="removeValue(index)"
          />
        </div>

        <div class="control-group">
          <div class="control-head">
            <span class="field-label">Filter</span>
            <button type="button" class="btn btn-ghost btn-small" @click="addFilter">
              + Tambah
            </button>
          </div>
          <FilterBuilder
            v-for="(filter, index) in config.filters"
            :key="index"
            :filter="filter"
            :meta="meta"
            :index="index"
            @update="updateFilter(index, $event)"
            @remove="removeFilter(index)"
          />
          <p v-if="config.filters.length === 0" class="hint">Tanpa filter, seluruh data dipakai.</p>
        </div>

        <div class="actions">
          <button type="button" class="btn btn-primary" :disabled="!canRun || running" @click="run">
            {{ running ? 'Memproses…' : 'Tampilkan Laporan' }}
          </button>
          <button type="button" class="btn btn-secondary" @click="reset">Reset</button>
          <button type="button" class="btn btn-secondary" :disabled="!result" @click="downloadCsv">
            Export CSV
          </button>
        </div>

        <div v-if="result" class="save-row">
          <input v-model="reportName" type="text" placeholder="Nama laporan tersimpan…" @keyup.enter="handleSave" />
          <button type="button" class="btn btn-secondary btn-small" :disabled="!reportName.trim()" @click="handleSave">
            Simpan
          </button>
        </div>
      </aside>

      <section class="results" v-reveal="1">
        <div v-if="error" class="error-banner" role="alert">{{ error }}</div>

        <div v-if="loading && !meta" class="state-card card">
          <p>Memuat data referensi…</p>
        </div>

        <div v-else-if="result" class="result-stack">
          <div class="result-summary">
            <span class="summary-text">{{ summary }}</span>
            <span class="tag tag-green">Siap dirender</span>
          </div>
          <ReportTable :result="result" />
          <div class="chart-card card">
            <h3 class="chart-title">Visualisasi</h3>
            <BarChart :result="result" />
          </div>
        </div>

        <div v-else-if="!running" class="state-card card">
          <p class="state-text">Belum ada laporan.</p>
          <p class="state-hint">
            Atur konfigurasi di panel kiri, lalu tekan <kbd>Tampilkan Laporan</kbd>.
          </p>
        </div>
      </section>
    </div>
  </main>

  <div class="container saved-section">
    <SavedReports
      :reports="savedReports"
      @load="handleLoad"
      @delete="deleteSaved"
    />
  </div>
</template>

<style scoped>
.page-header {
  position: relative;
  padding: clamp(80px, 14vw, 160px) 0 clamp(48px, 8vw, 88px);
}

.eyebrow {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 28px;
}

.page-title {
  max-width: 860px;
  font-size: clamp(38px, 6vw, 68px);
  letter-spacing: -0.03em;
  line-height: 1.05;
  margin-bottom: 24px;
}

.page-lead {
  max-width: 560px;
  color: var(--muted);
  font-size: 17px;
}

.builder-section {
  padding: 0 0 var(--pad-section);
}

.builder-grid {
  display: grid;
  grid-template-columns: 380px minmax(0, 1fr);
  gap: 48px;
  align-items: start;
}

@media (max-width: 960px) {
  .builder-grid {
    grid-template-columns: 1fr;
    gap: 32px;
  }
}

.config-panel {
  padding: 32px;
  position: sticky;
  top: 24px;
}

@media (max-width: 960px) {
  .config-panel {
    position: static;
  }
}

.panel-title {
  font-size: 24px;
  margin-bottom: 28px;
}

.control-group {
  padding: 20px 0;
  border-bottom: 1px solid var(--border);
}

.control-group:first-of-type {
  padding-top: 0;
}

.control-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.row-entry {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: end;
  margin-bottom: 8px;
}

.hint {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--muted);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 24px;
}

.save-row {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.save-row input {
  flex: 1;
}

.results {
  min-width: 0;
}

.error-banner {
  background: var(--pastel-red-bg);
  color: var(--pastel-red);
  border: 1px solid rgba(159, 47, 45, 0.18);
  border-radius: var(--radius);
  padding: 14px 18px;
  margin-bottom: 24px;
  font-size: 14px;
}

.result-stack {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.result-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.summary-text {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--muted);
}

.chart-card {
  padding: 28px 32px;
}

.chart-title {
  font-size: 20px;
  margin-bottom: 20px;
}

.state-card {
  padding: 64px 32px;
  text-align: center;
}

.state-text {
  font-family: var(--font-serif);
  font-size: 22px;
  color: var(--ink-strong);
  margin-bottom: 8px;
}

.state-hint {
  color: var(--muted);
  font-size: 14px;
  margin: 0;
}

.saved-section {
  padding-bottom: var(--pad-section);
}
</style>
