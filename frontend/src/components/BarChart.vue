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

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

const props = defineProps({
  result: { type: Object, required: true },
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

const labels = computed(() =>
  rows.value.map((row) => rowFields.value.map((field) => row.key[field.key]).join(' · ')),
);

const palette = ['#2f3437', '#1f6c9f', '#346538', '#956400', '#9f2f2d', '#787774'];

const chartData = computed(() => {
  const index = valueIndex.value;
  if (columnField.value) {
    return {
      labels: labels.value,
      datasets: columnKeys.value.map((columnKey, i) => ({
        label: columnKey,
        data: rows.value.map((row) => row.cells[columnKey][index]),
        backgroundColor: palette[i % palette.length],
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
        data: rows.value.map((row) => row.cells[ALL][index]),
        backgroundColor: palette[0],
        borderRadius: 2,
        maxBarThickness: 42,
      },
    ],
  };
});

const isCurrentCount = computed(() => {
  return valueColumns.value[valueIndex.value]?.aggregation === 'count';
});

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
          return isCurrentCount.value
            ? ` ${context.dataset.label}: ${val.toLocaleString('id-ID')}`
            : ` ${context.dataset.label}: Rp${val.toLocaleString('id-ID')}`;
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
      <select v-model="valueIndex">
        <option v-for="(valueColumn, index) in valueColumns" :key="index" :value="index">
          {{ valueColumn.label }}
        </option>
      </select>
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

.chart-control select {
  width: auto;
  min-width: 200px;
}

.chart-canvas {
  position: relative;
  height: 320px;
}
</style>
