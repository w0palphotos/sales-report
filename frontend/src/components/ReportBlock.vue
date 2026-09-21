<script setup>
import { ref } from 'vue';
import PivotToolbar from './PivotToolbar.vue';
import FilterDrawer from './FilterDrawer.vue';
import CellColorPopover from './CellColorPopover.vue';
import SaveDrawer from './SaveDrawer.vue';
import ReportTable from './ReportTable.vue';
import BarChart from './BarChart.vue';
import { colorMapToArray, styleKey, tableStylesToArray } from '../utils/cellStyle.js';

const props = defineProps({
  block: { type: Object, required: true },
  index: { type: Number, required: true },
});

const emit = defineEmits(['remove', 'toggle-chart', 'rename']);

const builder = props.block.builder;

const filteredResult = ref(null);
const reportName = ref('');
const showFilters = ref(false);
const showSaveModal = ref(false);
const colorTarget = ref(null);
const colorError = ref('');
const editingTitle = ref(false);
const titleDraft = ref('');

function startRename() {
  titleDraft.value = props.block.title ?? '';
  editingTitle.value = true;
}

function commitRename() {
  editingTitle.value = false;
  emit('rename', titleDraft.value);
}

function toggleFilters() {
  showFilters.value = !showFilters.value;
  if (showFilters.value && builder.config.filters.length === 0) {
    builder.addFilter();
  }
}

function onEditColor({ options, x, y }) {
  if (!options || options.length === 0) return;
  colorError.value = '';
  colorTarget.value = { options, x, y };
}

function closeColorPopover() {
  colorTarget.value = null;
  colorError.value = '';
}

function saveCategoryColor({ field, value, scope, bg, color }) {
  if (scope === 'global') {
    const arr = colorMapToArray(builder.globalColors);
    const idx = arr.findIndex((item) => item.field === field && item.value === value);
    const entry = { field, value, bg, color };
    if (idx >= 0) arr[idx] = entry;
    else arr.push(entry);
    return builder.saveGlobalColors(arr);
  }
  builder.setColorOverride({
    ...builder.config.colors,
    [field]: { ...(builder.config.colors?.[field] ?? {}), [value]: { bg, color } },
  });
  return Promise.resolve(true);
}

function removeCategoryColor({ field, value, scope }) {
  if (scope === 'global') {
    const arr = colorMapToArray(builder.globalColors).filter(
      (item) => !(item.field === field && item.value === value),
    );
    return builder.saveGlobalColors(arr);
  }
  const override = JSON.parse(JSON.stringify(builder.config.colors ?? {}));
  if (override[field]?.[value]) delete override[field][value];
  if (override[field] && Object.keys(override[field]).length === 0) delete override[field];
  builder.setColorOverride(override);
  return Promise.resolve(true);
}

function saveTableStyle({ kind, key, scope, bg, color }) {
  const entry = { kind, key, bg, color };
  if (scope === 'global') {
    const arr = tableStylesToArray(builder.tableStyles).filter(
      (item) => !(item.kind === kind && item.key === key),
    );
    arr.push(entry);
    return builder.saveGlobalTableStyles(arr);
  }
  builder.setTableStylesOverride({
    ...builder.config.styles,
    [styleKey(kind, key)]: entry,
  });
  return Promise.resolve(true);
}

function removeTableStyle({ kind, key, scope }) {
  if (scope === 'global') {
    const arr = tableStylesToArray(builder.tableStyles).filter(
      (item) => !(item.kind === kind && item.key === key),
    );
    return builder.saveGlobalTableStyles(arr);
  }
  const override = JSON.parse(JSON.stringify(builder.config.styles ?? {}));
  delete override[styleKey(kind, key)];
  builder.setTableStylesOverride(override);
  return Promise.resolve(true);
}

async function onSaveColor(payload) {
  if (!colorTarget.value) return;
  const ok =
    payload.kind === 'category'
      ? await saveCategoryColor(payload)
      : await saveTableStyle(payload);
  if (ok) closeColorPopover();
  else colorError.value = builder.error || 'Gagal menyimpan warna.';
}

async function onRemoveColor(payload) {
  if (!colorTarget.value) return;
  const ok =
    payload.kind === 'category'
      ? await removeCategoryColor(payload)
      : await removeTableStyle(payload);
  if (ok) closeColorPopover();
  else colorError.value = builder.error || 'Gagal menghapus warna.';
}

// Hapus semua warna (laporan ini + global) lalu tutup popover.
async function onResetColor() {
  await builder.resetTableColors();
  closeColorPopover();
}

async function handleSave() {
  const ok = await builder.saveReport(reportName.value);
  if (ok) {
    reportName.value = '';
    showSaveModal.value = false;
  }
}

function handleExport() {
  builder.downloadXlsx(
    filteredResult.value || builder.result,
    blockColors(),
    blockTableStyles(),
    props.block.title,
  );
}

function blockColors() {
  return {
    global: builder.globalColors,
    override: builder.config.colors,
  };
}

function blockTableStyles() {
  return {
    global: builder.tableStyles,
    override: builder.config.styles,
  };
}
</script>

<template>
  <section class="spreadsheet-card card">
    <div class="block-head">
      <span
        v-if="!editingTitle"
        class="block-title block-title-editable"
        title="Klik untuk ganti nama"
        @click="startRename"
      >
        {{ block.title || `Laporan ${index + 1}` }}
      </span>
      <input
        v-else
        v-model="titleDraft"
        class="block-title-input"
        maxlength="80"
        @keyup.enter="commitRename"
        @blur="commitRename"
      />
      <div class="block-actions">
        <button type="button" class="btn btn-ghost btn-small" @click="emit('toggle-chart')">
          {{ block.showChart ? 'Sembunyikan grafik' : 'Tampilkan grafik' }}
        </button>
        <button type="button" class="btn btn-ghost btn-small" @click="emit('remove')">
          Hapus blok
        </button>
      </div>
    </div>

    <div v-if="builder.error" class="error-banner" role="alert">{{ builder.error }}</div>

    <PivotToolbar
      :config="builder.config"
      :meta="builder.meta"
      :running="builder.running"
      :has-result="!!builder.result"
      :show-filters="showFilters"
      @set-row="builder.setRow"
      @remove-row="builder.removeRow"
      @add-row="builder.addRow"
      @set-column="builder.setColumn"
      @clear-column="builder.clearColumn"
      @update-value="builder.updateValue"
      @remove-value="builder.removeValue"
      @add-value="builder.addValue"
      @toggle-filters="toggleFilters"
      @export="handleExport"
      @toggle-save="showSaveModal = !showSaveModal"
      @reset="builder.reset"
    />

    <FilterDrawer
      v-if="showFilters || builder.config.filters.length > 0"
      :filters="builder.config.filters"
      :meta="builder.meta"
      @update="builder.updateFilter"
      @remove="builder.removeFilter"
      @add="builder.addFilter"
    />

    <CellColorPopover
      v-if="colorTarget"
      :options="colorTarget.options"
      :x="colorTarget.x"
      :y="colorTarget.y"
      :error="colorError"
      @save="onSaveColor"
      @remove="onRemoveColor"
      @reset="onResetColor"
      @close="closeColorPopover"
    />

    <SaveDrawer
      v-if="showSaveModal && builder.result"
      v-model="reportName"
      @save="handleSave"
      @cancel="showSaveModal = false"
    />

    <div v-if="builder.result" class="sheet-grid-wrapper">
      <ReportTable
        :result="builder.result"
        :colors="blockColors()"
        :table-styles="blockTableStyles()"
        @filter-change="filteredResult = $event"
        @edit-color="onEditColor"
        @apply-preset="builder.applyTablePreset"
        @reset-color="builder.resetTableColors"
      />
    </div>
    <div v-else class="sheet-empty">
      <p>Pilih minimal satu baris, kolom, atau nilai untuk menampilkan pivot tabel.</p>
    </div>
  </section>

  <section
    v-if="
      block.showChart &&
      builder.result &&
      (builder.result.rows?.length > 0 ||
        (filteredResult && filteredResult.rows?.length > 0))
    "
    class="chart-card card"
  >
    <h3 class="chart-title">Visualisasi</h3>
    <Suspense>
      <BarChart
        :result="filteredResult || builder.result"
        :colors="blockColors()"
        :table-styles="blockTableStyles()"
      />
      <template #fallback>
        <p class="chart-loading">Memuat grafik…</p>
      </template>
    </Suspense>
  </section>
</template>

<style scoped>
.spreadsheet-card {
  padding: 0;
  overflow: hidden;
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #e5e5e3);
  border-radius: var(--radius, 8px);
}

.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: var(--surface-alt, #f7f6f3);
  border-bottom: 1px solid var(--border, #e5e5e3);
  flex-wrap: wrap;
}

.block-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-strong, #111111);
}

.block-title-editable {
  cursor: text;
  border-bottom: 1px dashed var(--border-strong, #999);
}

.block-title-input {
  font-size: 14px;
  font-weight: 700;
  max-width: 280px;
}

.block-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.error-banner {
  background: var(--pastel-red-bg);
  color: var(--pastel-red);
  border-bottom: 1px solid rgba(159, 47, 45, 0.18);
  padding: 12px 16px;
  font-size: 14px;
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
</style>
