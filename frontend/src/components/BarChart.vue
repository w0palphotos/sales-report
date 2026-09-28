<script setup>
import { computed, ref, watch } from 'vue';
import { Bar } from 'vue-chartjs';
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
} from 'chart.js';
import { formatCompact } from '../utils/format.js';
import { isCountAggregation } from '../utils/aggregation.js';
import { resolveColor, resolveTableStyle, rowSignature } from '../utils/cellStyle.js';
import DropdownSelect from './DropdownSelect.vue';

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

const props = defineProps({
  result: { type: Object, required: true },
  colors: { type: Object, default: () => ({ global: {}, override: {} }) },
  tableStyles: { type: Object, default: () => ({ global: {}, override: {} }) },
});

const ALL = '__all__';

const valueIndex = ref(0);

watch(
  () => props.result,
  () => {
    valueIndex.value = 0;
  },
);

const valueColumns = computed(() => props.result.meta.valueColumns ?? []);
const columnField = computed(() => props.result.meta.columnField ?? null);
const columnKeys = computed(() => props.result.columnKeys ?? []);
const rowFields = computed(() => props.result.meta.rowFields ?? []);
const rows = computed(() => props.result.rows ?? []);

const chartRows = computed(() => {
  const r = [...rows.value];
  if (props.result.grandTotal) {
    r.push({
      key: {},
      cells: props.result.columnTotals ?? {},
      rowTotal: props.result.grandTotal,
    });
  }
  return r;
});

const labels = computed(() =>
  chartRows.value.map((row) => {
    const rFields = rowFields.value;
    if (rFields.length === 0) return 'Grand Total';
    if (row.key && Object.keys(row.key).length === 0) return 'Grand Total';

    const rolledUpIndex = rFields.findIndex((rf) => row.key?.[rf.key] == null);
    if (rolledUpIndex === 0) return 'Grand Total';
    if (rolledUpIndex > 0) return `${row.key?.[rFields[rolledUpIndex - 1].key]} Total`;

    return row.key?.[rFields[rFields.length - 1].key] ?? '';
  }),
);

const palette = ['#1f6c9f', '#346538', '#956400', '#9f2f2d', '#787774', '#2f3437'];

function seriesColor(columnKey, fallback) {
  if (!columnField.value) return fallback;
  const rule = resolveColor(columnField.value.key, columnKey, props.colors ?? {});
  if (rule?.bg) return rule.bg;
  const styles = props.tableStyles ?? {};
  const cs = resolveTableStyle(
    'column',
    `col:${columnField.value.key}:${columnKey}`,
    styles,
  );
  return cs?.bg ?? fallback;
}

// Tiap bar: kategori penuh dulu, lalu aturan baris, lalu fallback.
function barColorForRow(row, fallback) {
  for (const field of rowFields.value) {
    const rule = resolveColor(field.key, row.key?.[field.key], props.colors ?? {});
    if (rule?.bg) return rule.bg;
  }
  const rs = resolveTableStyle(
    'row',
    rowSignature(row.key, rowFields.value),
    props.tableStyles ?? {},
  );
  return rs?.bg ?? fallback;
}

const chartData = computed(() => {
  const index = valueIndex.value;
  if (columnField.value) {
    const keys = [...columnKeys.value, 'Grand Total'];
    return {
      labels: labels.value,
      datasets: keys.map((columnKey, i) => ({
        label: columnKey,
        data: chartRows.value.map((row) => {
          if (columnKey === 'Grand Total') return row.rowTotal?.[index] ?? 0;
          return row.cells?.[columnKey]?.[index] ?? 0;
        }),
        backgroundColor:
          columnKey === 'Grand Total'
            ? '#eab308'
            : seriesColor(columnKey, palette[i % palette.length]),
        borderRadius: 2,
        maxBarThickness: 36,
      })),
    };
  }
  return {
    labels: labels.value,
    datasets: [
      {
        label: valueColumns.value[index]?.label ?? 'Nilai',
        data: chartRows.value.map((row) => {
          if (row.key && Object.keys(row.key).length === 0) return row.rowTotal?.[index] ?? 0;
          return row.cells?.[ALL]?.[index] ?? 0;
        }),
        backgroundColor: chartRows.value.map((row) => {
          if (row.key && Object.keys(row.key).length === 0) return '#eab308';
          return barColorForRow(row, palette[0]);
        }),
        borderRadius: 2,
        maxBarThickness: 42,
      },
    ],
  };
});

const isCurrentCount = computed(() => {
  return isCountAggregation(valueColumns.value[valueIndex.value]?.aggregation);
});

const chartValueOptions = computed(() =>
  valueColumns.value.map((valueColumn, index) => ({ value: index, label: valueColumn.label })),
);

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: Boolean(columnField.value),
      position: 'bottom',
      labels: { color: '#787774', font: { family: 'inherit', size: 12 }, boxWidth: 12, boxHeight: 12 },
    },
    tooltip: {
      callbacks: {
        label: (context) => {
          const val = Number(context.parsed.y);
          return ` ${context.dataset.label}: ${val.toLocaleString('id-ID')}`;
        },
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#787774', font: { family: 'inherit', size: 12 } },
    },
    y: {
      beginAtZero: true,
      grid: { color: '#eaeaea' },
      border: { display: false },
      ticks: {
        color: '#787774',
        font: { family: 'inherit', size: 12 },
        callback: (val) => (isCurrentCount.value ? Number(val).toLocaleString('id-ID') : formatCompact(val)),
      },
    },
  },
}));
</script>

<template>
  <div class="chart" v-if="result">
    <div v-if="valueColumns.length > 1" class="chart-control">
      <span class="field-label">Nilai yang digambar</span>
      <div class="chart-picker">
        <DropdownSelect
          :model-value="valueIndex"
          :options="chartValueOptions"
          aria-label="Pilih nilai yang digambar"
          @update:model-value="valueIndex = Number($event)"
        />
      </div>
    </div>
    <div class="chart-canvas">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

<style scoped>
.chart-control {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.chart-picker {
  flex: 0 1 260px;
  min-width: 200px;
}

.chart-canvas {
  position: relative;
  height: 320px;
}
</style>
