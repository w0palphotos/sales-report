<script setup>
import { computed, nextTick, onMounted, ref, toRef, watch } from 'vue';
import { HotTable } from '@handsontable/vue3';
import { registerAllModules } from 'handsontable/registry';
import Handsontable from 'handsontable';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import { formatRupiah } from '../utils/format.js';
import { font, resolveColor, applyBuiltStyle, DEFAULT_TEXT } from '../utils/cellStyle.js';
import { usePivotGrid } from '../composables/usePivotGrid.js';

registerAllModules();

const props = defineProps({
  result: { type: Object, required: true },
  colors: { type: Object, default: () => ({ global: {}, override: {}, enabled: true }) },
});

const emit = defineEmits(['filter-change', 'toggle-colors']);

const hotRef = ref(null);

const resultRef = toRef(props, 'result');
const { rowDimCount, nestedHeaders, tableData, getVisibleResult } = usePivotGrid(resultRef);

function cellRenderer(instance, td, row, col, prop, value, cellProperties) {
  Handsontable.renderers.TextRenderer.apply(this, arguments);
  const totalRowIndex = instance.countRows() - 1;
  const isTotalRow = rowDimCount.value > 0 && row === totalRowIndex;
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
    const fieldKey = rFields[col]?.key;
    const rule = fieldKey ? resolveColor(fieldKey, value, props.colors ?? {}) : null;
    if (rule && props.colors?.enabled !== false) {
      applyBuiltStyle(td, font(value).bg(rule.bg).color(rule.color ?? DEFAULT_TEXT).build());
    }
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

// Aturan warna efektif untuk laporan ini (override menimpa global).
const legendRules = computed(() => {
  const rFields = props.result?.meta?.rowFields ?? [];
  const out = [];
  const seen = new Set();
  for (const rf of rFields) {
    const merged = {
      ...(props.colors?.global?.[rf.key] ?? {}),
      ...(props.colors?.override?.[rf.key] ?? {}),
    };
    for (const [val, rule] of Object.entries(merged)) {
      const key = `${rf.key}::${val}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        field: rf.key,
        fieldLabel: rf.label,
        value: val,
        bg: rule.bg,
        color: rule.color,
        fromOverride: Boolean(props.colors?.override?.[rf.key]?.[val]),
      });
    }
  }
  return out;
});

const hotSettings = computed(() => ({
  data: tableData.value,
  nestedHeaders: nestedHeaders.value,
  readOnly: true,
  // ponytail: read-only mode for report viewer; upgrade to editable if live calculation needed
  licenseKey: 'non-commercial-and-evaluation',
  renderer: cellRenderer,
  columnSorting: true,
  dropdownMenu: false,
  filters: false,
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
    <div v-if="legendRules.length > 0" class="color-legend">
      <label class="legend-toggle">
        <input
          type="checkbox"
          :checked="colors?.enabled !== false"
          @change="emit('toggle-colors')"
        />
        Warnai kategori
      </label>
      <span
        v-if="colors?.enabled !== false"
        v-for="rule in legendRules"
        :key="rule.field + '::' + rule.value"
        class="legend-item"
        :title="rule.fieldLabel + (rule.fromOverride ? ' (laporan ini)' : '')"
      >
        <span class="legend-swatch" :style="{ background: rule.bg, color: rule.color || '#2f3437' }">
          {{ rule.value }}
        </span>
      </span>
    </div>
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

.color-legend {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px 12px;
}

.legend-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-strong, #111111);
  margin-right: 4px;
}

.legend-swatch {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid var(--border, #e5e5e3);
}
</style>
