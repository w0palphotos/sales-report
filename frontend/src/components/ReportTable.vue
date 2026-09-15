<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { HotTable } from '@handsontable/vue3';
import { registerAllModules } from 'handsontable/registry';
import Handsontable from 'handsontable';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import { formatRupiah } from '../utils/format.js';

registerAllModules();

const props = defineProps({
  result: { type: Object, required: true },
});

const emit = defineEmits(['filter-change']);

const hotRef = ref(null);

const rowFields = computed(() => props.result.meta.rowFields ?? []);
const columnField = computed(() => props.result.meta.columnField ?? null);
const valueColumns = computed(() => props.result.meta.valueColumns ?? []);
const columnKeys = computed(() => props.result.columnKeys ?? []);
const columnTotals = computed(() => props.result.columnTotals ?? {});
const grandTotal = computed(() => props.result.grandTotal ?? []);

const rowDimCount = computed(() => rowFields.value.length);

const nestedHeaders = computed(() => {
  if (!props.result) return [];
  const rows = rowFields.value;
  const vals = valueColumns.value;
  const cols = columnKeys.value;

  if (columnField.value) {
    const topRow = [
      ...rows.map((rf) => ({ label: rf.label, rowspan: 2 })),
      ...cols.map((ck) => ({ label: ck, colspan: vals.length })),
      { label: 'Grand Total', colspan: vals.length },
    ];
    const bottomRow = [
      ...cols.flatMap(() => vals.map((v) => v.label)),
      ...vals.map((v) => v.label),
    ];
    return [topRow, bottomRow];
  }

  return [
    [
      ...rows.map((rf) => rf.label),
      ...vals.map((v) => v.label),
    ],
  ];
});

const tableData = computed(() => {
  if (!props.result) return [];
  const data = [];
  const rFields = rowFields.value;
  const cKeys = columnKeys.value;
  const hasCol = Boolean(columnField.value);

  // Data rows
  for (const row of props.result.rows ?? []) {
    const rowArr = [];
    for (const rf of rFields) {
      rowArr.push(row.key[rf.key] ?? '');
    }
    if (hasCol) {
      for (const ck of cKeys) {
        const cellVals = row.cells[ck] ?? [];
        for (const val of cellVals) {
          rowArr.push(val);
        }
      }
      for (const val of row.rowTotal ?? []) {
        rowArr.push(val);
      }
    } else {
      for (const val of row.cells['__all__'] ?? []) {
        rowArr.push(val);
      }
    }
    data.push(rowArr);
  }

  // Total footer row
  const totalRow = [];
  rFields.forEach((_, i) => {
    totalRow.push(i === 0 ? 'Grand Total' : '');
  });
  if (hasCol) {
    for (const ck of cKeys) {
      const colTot = columnTotals.value[ck] ?? [];
      for (const val of colTot) {
        totalRow.push(val);
      }
    }
    for (const val of grandTotal.value) {
      totalRow.push(val);
    }
  } else {
    for (const val of grandTotal.value) {
      totalRow.push(val);
    }
  }
  data.push(totalRow);

  return data;
});

function cellRenderer(instance, td, row, col, prop, value, cellProperties) {
  Handsontable.renderers.TextRenderer.apply(this, arguments);
  const totalRowIndex = instance.countRows() - 1;
  const isTotalRow = row === totalRowIndex;
  const isValueCol = col >= rowDimCount.value;

  if (isValueCol && typeof value === 'number') {
    td.innerText = formatRupiah(value);
    td.style.textAlign = 'right';
    td.style.fontVariantNumeric = 'tabular-nums';
  } else if (!isValueCol) {
    td.style.textAlign = 'left';
    td.style.fontWeight = '500';
  }

  if (isTotalRow) {
    td.style.fontWeight = '700';
    td.style.background = 'var(--surface-alt, #f7f6f3)';
    td.style.borderTop = '2px solid var(--border, #e5e5e3)';
  }
}

function getVisibleResult(instance) {
  if (!instance || !props.result) return props.result;
  const count = instance.countRows();
  const visibleRows = [];
  const rawRows = props.result.rows ?? [];
  const totalRowPhysicalIndex = rawRows.length;

  for (let visualRow = 0; visualRow < count; visualRow++) {
    const physicalRow = instance.toPhysicalRow(visualRow);
    if (physicalRow >= 0 && physicalRow < totalRowPhysicalIndex && rawRows[physicalRow]) {
      visibleRows.push(rawRows[physicalRow]);
    }
  }

  const hasCol = Boolean(columnField.value);
  const valCount = valueColumns.value.length;
  const cKeys = columnKeys.value;

  const recalculatedColumnTotals = {};
  for (const ck of cKeys) {
    recalculatedColumnTotals[ck] = Array(valCount).fill(0);
  }
  const recalculatedGrandTotal = Array(valCount).fill(0);

  for (const row of visibleRows) {
    if (hasCol) {
      for (const ck of cKeys) {
        const cells = row.cells[ck] ?? [];
        for (let v = 0; v < valCount; v++) {
          recalculatedColumnTotals[ck][v] += Number(cells[v]) || 0;
        }
      }
      for (let v = 0; v < valCount; v++) {
        recalculatedGrandTotal[v] += Number(row.rowTotal?.[v]) || 0;
      }
    } else {
      const cells = row.cells['__all__'] ?? [];
      for (let v = 0; v < valCount; v++) {
        recalculatedGrandTotal[v] += Number(cells[v]) || 0;
      }
    }
  }

  return {
    ...props.result,
    rows: visibleRows,
    columnTotals: recalculatedColumnTotals,
    grandTotal: recalculatedGrandTotal,
  };
}

function notifyFilterChange() {
  nextTick(() => {
    const instance = hotRef.value?.hotInstance;
    if (instance) {
      const filtered = getVisibleResult(instance);
      emit('filter-change', filtered);
    }
  });
}

const hotSettings = computed(() => ({
  data: tableData.value,
  nestedHeaders: nestedHeaders.value,
  readOnly: true,
  // ponytail: read-only mode for report viewer; upgrade to editable if live calculation needed
  licenseKey: 'non-commercial-and-evaluation',
  renderer: cellRenderer,
  columnSorting: true,
  dropdownMenu: true,
  filters: true,
  hiddenColumns: { indicators: true },
  hiddenRows: { indicators: true },
  contextMenu: ['hidden_columns_show', 'hidden_columns_hide'],
  stretchH: 'all',
  autoWrapRow: true,
  autoWrapCol: true,
  height: 'auto',
  rowHeaders: true,
  manualColumnResize: true,
  themeName: 'ht-theme-main',
  afterFilter() {
    notifyFilterChange();
  },
  afterColumnSort() {
    notifyFilterChange();
  },
}));

watch(
  () => props.result,
  (newVal) => {
    if (newVal) {
      emit('filter-change', newVal);
    }
  },
  { immediate: true },
);

onMounted(() => {
  if (props.result) {
    emit('filter-change', props.result);
  }
});

defineExpose({
  hotRef,
  tableData,
});
</script>

<template>
  <div class="hot-container">
    <HotTable :key="JSON.stringify(nestedHeaders) + '-' + tableData.length" ref="hotRef" :settings="hotSettings" />
  </div>
</template>

<style scoped>
.hot-container {
  width: 100%;
  overflow-x: auto;
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
