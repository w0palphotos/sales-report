<script setup>
import { defineAsyncComponent, onMounted, ref } from 'vue';
import { useReportBuilder } from '../composables/useReportBuilder.js';
import { api } from '../api/client.js';
import RawDataTable from './RawDataTable.vue';
import PivotToolbar from './PivotToolbar.vue';
import FilterDrawer from './FilterDrawer.vue';
import ColorEditor from './ColorEditor.vue';
import SaveDrawer from './SaveDrawer.vue';
import ReportTable from './ReportTable.vue';
import SavedReports from './SavedReports.vue';

const BarChart = defineAsyncComponent(() => import('./BarChart.vue'));

const {
  meta,
  loading,
  running,
  error,
  result,
  savedReports,
  config,
  globalColors,
  colorsEnabled,
  canRun,
  loadMeta,
  loadColors,
  saveGlobalColors,
  setColorOverride,
  clearColorOverride,
  toggleColorsEnabled,
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
const showColors = ref(false);
const showSaveModal = ref(false);

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
}

function handleExport() {
  downloadXlsx(filteredResult.value || result.value);
}

function toggleFilters() {
  showFilters.value = !showFilters.value;
  if (showFilters.value && config.filters.length === 0) {
    addFilter();
  }
}

function toggleColors() {
  showColors.value = !showColors.value;
}

async function handleSaveGlobalColors(colors) {
  const ok = await saveGlobalColors(colors);
  if (ok) showColors.value = false;
}

onMounted(async () => {
  await Promise.all([loadMeta(), refreshSaved(), loadRawSales(), loadColors()]);
  if (canRun.value) {
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
    <section v-else-if="meta" class="spreadsheet-card card">
      <PivotToolbar
        :config="config"
        :meta="meta"
        :running="running"
        :has-result="!!result"
        :show-filters="showFilters"
        :show-colors="showColors"
        @set-row="setRow"
        @remove-row="removeRow"
        @add-row="addRow"
        @set-column="setColumn"
        @clear-column="clearColumn"
        @update-value="updateValue"
        @remove-value="removeValue"
        @add-value="addValue"
        @toggle-filters="toggleFilters"
        @toggle-colors="toggleColors"
        @export="handleExport"
        @toggle-save="showSaveModal = !showSaveModal"
        @reset="reset"
      />

      <FilterDrawer
        v-if="showFilters || config.filters.length > 0"
        :filters="config.filters"
        :meta="meta"
        @update="updateFilter"
        @remove="removeFilter"
        @add="addFilter"
      />

      <ColorEditor
        v-if="showColors"
        :meta="meta"
        :global-colors="globalColors"
        :override-colors="config.colors"
        @save-global="handleSaveGlobalColors"
        @save-override="setColorOverride"
        @clear-override="clearColorOverride"
      />

      <SaveDrawer
        v-if="showSaveModal && result"
        v-model="reportName"
        @save="handleSave"
        @cancel="showSaveModal = false"
      />

      <!-- Handsontable Spreadsheet View -->
      <div v-if="result" class="sheet-grid-wrapper">
        <ReportTable
          :result="result"
          :colors="{ global: globalColors, override: config.colors, enabled: colorsEnabled }"
          @filter-change="filteredResult = $event"
          @toggle-colors="toggleColorsEnabled"
        />
      </div>
      <div v-else class="sheet-empty">
        <p>Pilih minimal satu baris, kolom, atau nilai untuk menampilkan pivot tabel.</p>
      </div>
    </section>

    <!-- 3. Visualization Card -->
    <section
      v-if="result && (result.rows?.length > 0 || (filteredResult && filteredResult.rows?.length > 0))"
      class="chart-card card"
    >
      <h3 class="chart-title">Visualisasi</h3>
      <Suspense>
        <BarChart :result="filteredResult || result" />
        <template #fallback>
          <p class="chart-loading">Memuat grafik…</p>
        </template>
      </Suspense>
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

.sheet-grid-wrapper {
  padding: 12px;
}

.sheet-empty {
  padding: 48px 24px;
  text-align: center;
  color: var(--muted, #787774);
  font-size: 14px;
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

.chart-loading {
  padding: 48px 0;
  text-align: center;
  color: var(--muted, #787774);
  font-size: 13px;
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
</style>
