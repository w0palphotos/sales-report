<script setup>
import { computed, nextTick, onMounted, ref, toRef, watch } from 'vue';
import { HotTable } from '@handsontable/vue3';
import { registerAllModules } from 'handsontable/registry';
import Handsontable from 'handsontable';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import { formatRupiah } from '../utils/format.js';
import { usePivotGrid } from '../composables/usePivotGrid.js';

registerAllModules();

const props = defineProps({
  result: { type: Object, required: true },
});

const emit = defineEmits(['filter-change']);

const hotRef = ref(null);

const resultRef = toRef(props, 'result');
const { rowDimCount, nestedHeaders, tableData, getVisibleResult } = usePivotGrid(resultRef);

function cellRenderer(instance, td, row, col, prop, value, cellProperties) {
  Handsontable.renderers.TextRenderer.apply(this, arguments);
  const totalRowIndex = instance.countRows() - 1;
  const isTotalRow = row === totalRowIndex;
  const isValueCol = col >= rowDimCount.value;

  if (isValueCol && typeof value === 'number') {
    const vals = props.result?.meta?.valueColumns ?? [];
    const valIdx = vals.length ? (col - rowDimCount.value) % vals.length : 0;
    const isCount = vals[valIdx]?.aggregation === 'count';

    td.innerText = isCount ? value.toLocaleString('id-ID') : formatRupiah(value);
    td.style.textAlign = 'right';
    td.style.fontVariantNumeric = 'tabular-nums';
  } else if (!isValueCol) {
    const rFields = props.result?.meta?.rowFields ?? [];
    if (rFields[col]?.key === 'amount' && typeof value === 'number' && !isTotalRow) {
      td.innerText = formatRupiah(value);
      td.style.textAlign = 'right';
    } else {
      td.style.textAlign = 'left';
    }
    td.style.fontWeight = '500';
  }

  if (isTotalRow) {
    td.style.fontWeight = '700';
    td.style.background = 'var(--surface-alt, #f7f6f3)';
    td.style.borderTop = '2px solid var(--border, #e5e5e3)';
  }
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
