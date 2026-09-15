<script setup>
import { computed, onMounted, ref } from 'vue';
import { useReportBuilder } from '../composables/useReportBuilder.js';
import { api } from '../api/client.js';
import FieldSelect from './FieldSelect.vue';
import ValueBuilder from './ValueBuilder.vue';
import FilterBuilder from './FilterBuilder.vue';
import RawDataTable from './RawDataTable.vue';
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
  saveReport,
  loadReport,
  deleteSaved,
} = useReportBuilder();

const rawSales = ref([]);
const rawLoading = ref(false);
const filteredResult = ref(null);

const reportName = ref('');
const showFilters = ref(false);
const showSaveModal = ref(false);

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

async function loadRawSales() {
  rawLoading.value = true;
  try {
    const res = await api.listSales();
    rawSales.value = res?.sales ?? [];
  } catch (err) {
    console.error('Failed to load raw sales', err);
  } finally {
    rawLoading.value = false;
  }
}

async function handleSave() {
  const ok = await saveReport(reportName.value);
  if (ok) {
    reportName.value = '';
    showSaveModal.value = false;
  }
}

function handleLoad(report) {
  loadReport(report);
  run();
}

function toggleFilters() {
  showFilters.value = !showFilters.value;
  if (showFilters.value && config.filters.length === 0) {
    addFilter();
  }
}

onMounted(async () => {
  await Promise.all([loadMeta(), refreshSaved(), loadRawSales()]);
  if (canRun.value) {
    // ponytail: auto-run default report on mount so spreadsheet renders directly
    await run();
  }
});
</script>

<template>
  <div class="container builder-container">
    <!-- Error Banner -->
    <div v-if="error" class="error-banner" role="alert">{{ error }}</div>

    <!-- 1. Raw Sales Data Table Card -->
    <RawDataTable :sales="rawSales" />

    <!-- Loading State -->
    <div v-if="loading && !meta" class="state-card card">
      <p>Memuat data referensi…</p>
    </div>

    <!-- 2. Pivot Table Card with Integrated Controls -->
    <section v-else-if="result" class="spreadsheet-card card">
      <!-- Top Spreadsheet Control Bar -->
      <div class="sheet-toolbar">
        <div class="sheet-controls">
          <span class="sheet-title-badge">Pivot Table</span>

          <!-- Rows -->
          <div class="sheet-control-group">
            <span class="sheet-label">Baris:</span>
            <div v-for="(row, index) in config.rows" :key="'row-' + index" class="sheet-select-wrap">
              <FieldSelect
                :model-value="row"
                :options="rowOptionsFor(index)"
                placeholder="Baris"
                @update:model-value="setRow(index, $event)"
              />
              <button
                v-if="config.rows.length > 1"
                type="button"
                class="chip-remove"
                :aria-label="`Hapus baris ${index + 1}`"
                @click="removeRow(index)"
              >
                &times;
              </button>
            </div>
            <button
              v-if="config.rows.length < 3"
              type="button"
              class="btn btn-ghost btn-small"
              title="Tambah baris"
              @click="addRow"
            >
              +
            </button>
          </div>

          <div class="sheet-divider"></div>

          <!-- Columns -->
          <div class="sheet-control-group">
            <span class="sheet-label">Kolom:</span>
            <div class="sheet-select-wrap">
              <FieldSelect
                :model-value="config.columns[0] ?? ''"
                :options="columnOptionsFor()"
                placeholder="(Tanpa Kolom)"
                @update:model-value="$event ? setColumn($event) : clearColumn()"
              />
              <button
                v-if="config.columns.length"
                type="button"
                class="chip-remove"
                aria-label="Bersihkan kolom"
                @click="clearColumn"
              >
                &times;
              </button>
            </div>
          </div>

          <div class="sheet-divider"></div>

          <!-- Values -->
          <div class="sheet-control-group">
            <span class="sheet-label">Nilai:</span>
            <div v-for="(val, index) in config.values" :key="'val-' + index" class="sheet-val-wrap">
              <ValueBuilder
                :value="val"
                :meta="meta"
                :index="index"
                @update="updateValue(index, $event)"
                @remove="removeValue(index)"
              />
            </div>
            <button
              v-if="config.values.length < 3"
              type="button"
              class="btn btn-ghost btn-small"
              title="Tambah nilai"
              @click="addValue"
            >
              +
            </button>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="sheet-actions">
          <button
            type="button"
            class="btn btn-ghost btn-small"
            :class="{ active: showFilters || config.filters.length > 0 }"
            @click="toggleFilters"
          >
            Filter {{ config.filters.length > 0 ? `(${config.filters.length})` : '' }}
          </button>
          <button
            type="button"
            class="btn btn-primary btn-small"
            :disabled="!canRun || running"
            @click="run"
          >
            {{ running ? 'Memproses…' : 'Tampilkan Laporan' }}
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-small"
            :disabled="!result"
            @click="downloadXlsx(filteredResult || result)"
          >
            Export XLSX
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-small"
            :disabled="!result"
            @click="showSaveModal = !showSaveModal"
          >
            Simpan
          </button>
          <button type="button" class="btn btn-ghost btn-small" @click="reset">
            Reset
          </button>
        </div>
      </div>

      <!-- Expandable Filters Drawer -->
      <div v-if="showFilters || config.filters.length > 0" class="sheet-drawer">
        <div class="drawer-head">
          <span class="sheet-label">Filter Kondisi</span>
          <button type="button" class="btn btn-ghost btn-small" @click="addFilter">+ Tambah Filter</button>
        </div>
        <div class="drawer-list">
          <FilterBuilder
            v-for="(filter, index) in config.filters"
            :key="index"
            :filter="filter"
            :meta="meta"
            :index="index"
            @update="updateFilter(index, $event)"
            @remove="removeFilter(index)"
          />
        </div>
      </div>

      <!-- Save Report Drawer -->
      <div v-if="showSaveModal && result" class="sheet-drawer">
        <div class="save-row">
          <input
            v-model="reportName"
            type="text"
            placeholder="Nama konfigurasi laporan ini…"
            @keyup.enter="handleSave"
          />
          <button
            type="button"
            class="btn btn-primary btn-small"
            :disabled="!reportName.trim()"
            @click="handleSave"
          >
            Simpan
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-small"
            @click="showSaveModal = false"
          >
            Batal
          </button>
        </div>
      </div>

      <!-- Handsontable Spreadsheet View -->
      <div class="sheet-grid-wrapper">
        <ReportTable :result="result" @filter-change="filteredResult = $event" />
      </div>
    </section>

    <!-- 3. Visualization Card -->
    <section v-if="result" class="chart-card card">
      <h3 class="chart-title">Visualisasi</h3>
      <BarChart :result="filteredResult || result" />
    </section>

    <!-- 4. Saved Reports Section -->
    <div class="saved-section">
      <SavedReports
        :reports="savedReports"
        @load="handleLoad"
        @delete="deleteSaved"
      />
    </div>
  </div>
</template>

<style scoped>
.builder-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: var(--pad-section, 64px);
}

.spreadsheet-card {
  padding: 0;
  overflow: hidden;
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #e5e5e3);
  border-radius: var(--radius, 8px);
}

.sheet-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 14px;
  background: var(--surface-alt, #f7f6f3);
  border-bottom: 1px solid var(--border, #e5e5e3);
  flex-wrap: wrap;
}

.sheet-title-badge {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  background: var(--surface, #ffffff);
  color: var(--ink-strong, #111111);
  border: 1px solid var(--border, #e5e5e3);
  border-radius: var(--radius-sm, 4px);
}

.sheet-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.sheet-control-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sheet-label {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted, #787774);
  white-space: nowrap;
}

.sheet-select-wrap {
  display: flex;
  align-items: center;
  gap: 2px;
}

.sheet-val-wrap {
  display: flex;
  align-items: center;
}

.sheet-divider {
  width: 1px;
  height: 20px;
  background: var(--border, #e5e5e3);
}

.chip-remove {
  background: none;
  border: 0;
  font-size: 14px;
  color: var(--muted, #787774);
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
}

.chip-remove:hover {
  color: var(--ink-strong, #111111);
}

.sheet-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  flex-wrap: wrap;
}

.sheet-actions .btn.active {
  background: var(--surface, #ffffff);
  color: var(--ink-strong, #111111);
  border-color: var(--border-strong, #999);
}

.sheet-drawer {
  padding: 12px 14px;
  background: var(--surface, #ffffff);
  border-bottom: 1px solid var(--border, #e5e5e3);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.drawer-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.save-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.save-row input {
  max-width: 320px;
}

.sheet-grid-wrapper {
  padding: 12px;
}

.chart-card {
  padding: 24px 28px;
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #e5e5e3);
  border-radius: var(--radius, 8px);
}

.chart-title {
  font-size: 18px;
  margin-bottom: 16px;
}

.error-banner {
  background: var(--pastel-red-bg);
  color: var(--pastel-red);
  border: 1px solid rgba(159, 47, 45, 0.18);
  border-radius: var(--radius);
  padding: 12px 16px;
  font-size: 14px;
}

.state-card {
  padding: 48px 32px;
  text-align: center;
}

.saved-section {
  padding-top: 8px;
}

@media (max-width: 768px) {
  .sheet-actions {
    margin-left: 0;
    width: 100%;
  }
}
</style>
