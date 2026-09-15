<script setup>
import { computed, ref } from 'vue';
import { HotTable } from '@handsontable/vue3';
import { registerAllModules } from 'handsontable/registry';
import Handsontable from 'handsontable';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import { formatRupiah } from '../utils/format.js';

registerAllModules();

const props = defineProps({
  sales: { type: Array, default: () => [] },
});

const hotRef = ref(null);

const colHeaders = ['No', 'Nama Sales', 'Kota', 'Produk', 'Penjualan'];

const tableData = computed(() => {
  return props.sales.map((item, index) => [
    index + 1,
    item.salesperson_name ?? '',
    item.city_name ?? '',
    item.product_name ?? '',
    Number(item.amount) || 0,
  ]);
});

function cellRenderer(instance, td, row, col, prop, value, cellProperties) {
  Handsontable.renderers.TextRenderer.apply(this, arguments);
  if (col === 4 && typeof value === 'number') {
    td.innerText = formatRupiah(value);
    td.style.textAlign = 'right';
    td.style.fontVariantNumeric = 'tabular-nums';
  } else if (col === 0) {
    td.style.textAlign = 'center';
    td.style.color = 'var(--muted, #787774)';
    td.style.fontWeight = '500';
  } else {
    td.style.textAlign = 'left';
  }
}

const hotSettings = computed(() => ({
  data: tableData.value,
  colHeaders,
  columns: [
    { type: 'numeric', width: 60 },
    { type: 'text' },
    { type: 'text' },
    { type: 'text' },
    { type: 'numeric' },
  ],
  readOnly: true,
  // ponytail: read-only raw sales data viewer; upgrade to inline CRUD if needed
  licenseKey: 'non-commercial-and-evaluation',
  renderer: cellRenderer,
  columnSorting: true,
  dropdownMenu: true,
  filters: true,
  hiddenColumns: { indicators: true },
  hiddenRows: { indicators: true },
  stretchH: 'all',
  autoWrapRow: true,
  autoWrapCol: true,
  height: 'auto',
  rowHeaders: false,
  manualColumnResize: true,
  themeName: 'ht-theme-main',
}));
</script>

<template>
  <div class="raw-data-card card">
    <div class="raw-header">
      <div class="raw-title-group">
        <span class="raw-badge">Data Awal</span>
        <span class="raw-count">{{ sales.length }} Transaksi</span>
      </div>
      <span class="raw-hint">Tabel transaksi penjualan mentah sebelum diagregasi / pivot</span>
    </div>
    <div v-if="sales.length > 0" class="hot-container">
      <HotTable :key="sales.length" ref="hotRef" :settings="hotSettings" />
    </div>
    <div v-else class="raw-empty">
      <p>Belum ada data transaksi atau sedang memuat…</p>
    </div>
  </div>
</template>

<style scoped>
.raw-data-card {
  padding: 0;
  overflow: hidden;
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #e5e5e3);
  border-radius: var(--radius, 8px);
}

.raw-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 14px;
  background: var(--surface-alt, #f7f6f3);
  border-bottom: 1px solid var(--border, #e5e5e3);
  flex-wrap: wrap;
}

.raw-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.raw-badge {
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

.raw-count {
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  color: var(--muted, #787774);
}

.raw-hint {
  font-size: 12px;
  color: var(--muted, #787774);
}

.hot-container {
  width: 100%;
  overflow-x: auto;
  padding: 12px;
}

.raw-empty {
  padding: 24px;
  text-align: center;
  color: var(--muted, #787774);
  font-size: 13px;
}

:deep(.handsontable) {
  font-family: var(--font-sans, inherit);
  font-size: 13px;
  color: var(--ink, #2f3437);
}

:deep(.handsontable th) {
  font-weight: 600;
  background: var(--surface-alt, #f7f6f3);
  color: var(--ink-strong, #111111);
}

:deep(.handsontable td) {
  padding: 6px 10px;
}
</style>
