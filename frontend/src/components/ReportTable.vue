<script setup>
import { computed, ref } from 'vue';
import { formatRupiah } from '../utils/format.js';

const ALL = '__all__';

const props = defineProps({
  result: { type: Object, required: true },
});

const rowFields = computed(() => props.result.meta.rowFields ?? []);
const columnField = computed(() => props.result.meta.columnField ?? null);
const valueColumns = computed(() => props.result.meta.valueColumns ?? []);
const columnKeys = computed(() => props.result.columnKeys ?? []);
const columnTotals = computed(() => props.result.columnTotals ?? {});
const grandTotal = computed(() => props.result.grandTotal ?? []);

const active = ref(null);

const fmt = formatRupiah;

const isActive = (key) => (active.value?.key === key ? active.value.dir : '');

function toggleSort(key) {
  if (active.value?.key === key) {
    active.value = active.value.dir === 'asc' ? { ...active.value, dir: 'desc' } : null;
  } else {
    active.value = { key, dir: 'asc' };
  }
}

const sortedRows = computed(() => {
  const rows = props.result.rows ?? [];
  const sort = active.value;
  if (!sort) return rows;

  const getValue = (row) => {
    if (sort.key.startsWith('row:')) {
      return row.key[rowFields.value[Number(sort.key.slice(4))].key];
    }
    if (sort.key.startsWith('value')) {
      const [, colKey, vi] = sort.key.split(':');
      return row.cells[colKey || ALL]?.[Number(vi)] ?? 0;
    }
    return row.rowTotal[Number(sort.key.slice(6))] ?? 0;
  };

  const sign = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((x, y) => {
    const vx = getValue(x);
    const vy = getValue(y);
    if (vx === vy) return 0;
    if (typeof vx === 'string' && typeof vy === 'string') return vx.localeCompare(vy) * sign;
    return (vx > vy ? 1 : -1) * sign;
  });
});
</script>

<template>
  <div class="table-scroll card">
    <table class="report-table">
      <thead>
        <tr v-if="columnField" class="thead-group">
          <th :colspan="rowFields.length" class="corner">Baris</th>
          <th v-for="columnKey in columnKeys" :key="columnKey" :colspan="valueColumns.length" class="group-col">
            {{ columnKey }}
          </th>
          <th :colspan="valueColumns.length" class="group-col total">Total</th>
        </tr>
        <tr>
          <template v-if="columnField">
            <th v-for="(field, index) in rowFields" :key="'row-head-' + index" class="row-head" :class="isActive('row:' + index)">
              <button type="button" class="th-btn" @click="toggleSort('row:' + index)">
                {{ field.label }}<span v-if="isActive('row:' + index)" class="sort-mark">{{ isActive('row:' + index) === 'asc' ? '▲' : '▼' }}</span>
              </button>
            </th>
            <template v-for="columnKey in columnKeys" :key="'value-head-' + columnKey">
              <th
                v-for="(valueColumn, vi) in valueColumns"
                :key="valueColumn.field + valueColumn.aggregation"
                class="value-head"
                :class="isActive('value:' + columnKey + ':' + vi)"
              >
                <button type="button" class="th-btn" @click="toggleSort('value:' + columnKey + ':' + vi)">
                  {{ valueColumn.label }}<span v-if="isActive('value:' + columnKey + ':' + vi)" class="sort-mark">{{ isActive('value:' + columnKey + ':' + vi) === 'asc' ? '▲' : '▼' }}</span>
                </button>
              </th>
            </template>
            <th
              v-for="(valueColumn, vi) in valueColumns"
              :key="'total-head-' + vi"
              class="value-head"
              :class="isActive('total:' + vi)"
            >
              <button type="button" class="th-btn" @click="toggleSort('total:' + vi)">
                {{ valueColumn.label }}<span v-if="isActive('total:' + vi)" class="sort-mark">{{ isActive('total:' + vi) === 'asc' ? '▲' : '▼' }}</span>
              </button>
            </th>
          </template>
          <template v-else>
            <th v-for="(field, index) in rowFields" :key="'row-head-' + index" class="row-head" :class="isActive('row:' + index)">
              <button type="button" class="th-btn" @click="toggleSort('row:' + index)">
                {{ field.label }}<span v-if="isActive('row:' + index)" class="sort-mark">{{ isActive('row:' + index) === 'asc' ? '▲' : '▼' }}</span>
              </button>
            </th>
            <th
              v-for="(valueColumn, vi) in valueColumns"
              :key="'value-head-' + vi"
              class="value-head"
              :class="isActive('value::' + vi)"
            >
              <button type="button" class="th-btn" @click="toggleSort('value::' + vi)">
                {{ valueColumn.label }}<span v-if="isActive('value::' + vi)" class="sort-mark">{{ isActive('value::' + vi) === 'asc' ? '▲' : '▼' }}</span>
              </button>
            </th>
          </template>
        </tr>
      </thead>

      <tbody>
        <tr v-for="(row, rowIndex) in sortedRows" :key="rowIndex">
          <template v-if="columnField">
            <td v-for="(field, index) in rowFields" :key="'row-key-' + index" class="row-cell">{{ row.key[field.key] }}</td>
            <template v-for="columnKey in columnKeys" :key="'cell-' + columnKey">
              <td v-for="(valueColumn, vi) in valueColumns" :key="valueColumn.field + valueColumn.aggregation" class="num">
                {{ fmt(row.cells[columnKey][vi]) }}
              </td>
            </template>
            <td v-for="(valueColumn, vi) in valueColumns" :key="'row-total-' + vi" class="num strong">{{ fmt(row.rowTotal[vi]) }}</td>
          </template>
          <template v-else>
            <td v-for="(field, index) in rowFields" :key="'row-key-' + index" class="row-cell">{{ row.key[field.key] }}</td>
            <td v-for="(valueColumn, vi) in valueColumns" :key="'cell-' + vi" class="num strong">{{ fmt(row.cells[ALL][vi]) }}</td>
          </template>
        </tr>
      </tbody>

      <tfoot>
        <tr class="tfoot">
          <td :colspan="rowFields.length" class="row-cell strong">Total</td>
          <template v-if="columnField">
            <template v-for="columnKey in columnKeys" :key="'foot-' + columnKey">
              <td v-for="(valueColumn, vi) in valueColumns" :key="valueColumn.field + valueColumn.aggregation" class="num strong">
                {{ fmt(columnTotals[columnKey][vi]) }}
              </td>
            </template>
            <td v-for="(valueColumn, vi) in valueColumns" :key="'foot-total-' + vi" class="num strong">{{ fmt(grandTotal[vi]) }}</td>
          </template>
          <template v-else>
            <td v-for="(valueColumn, vi) in valueColumns" :key="'foot-total-' + vi" class="num strong">{{ fmt(grandTotal[vi]) }}</td>
          </template>
        </tr>
      </tfoot>
    </table>
  </div>
</template>

<style scoped>
.table-scroll {
  overflow-x: auto;
}

.report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.report-table th,
.report-table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

.report-table thead th {
  border-bottom: 1px solid var(--border);
  background: var(--surface-alt);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--muted);
}

.thead-group .corner {
  text-align: left;
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--faint);
}

.thead-group .group-col {
  text-align: center;
  border-left: 1px solid var(--border);
}

.thead-group .group-col.total {
  border-left: 2px solid var(--border);
}

.row-head {
  text-align: left;
}

.value-head {
  text-align: right;
  border-left: 1px solid var(--border);
}

.report-table thead th.asc,
.report-table thead th.desc {
  color: var(--ink-strong);
  background: var(--surface);
}

.th-btn {
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.sort-mark {
  font-size: 9px;
  color: var(--muted);
}

.row-cell {
  text-align: left;
  font-weight: 500;
  color: var(--ink-strong);
}

td.num {
  border-left: 1px solid var(--border);
  color: var(--ink);
}

td.strong {
  font-weight: 600;
  color: var(--ink-strong);
}

.tfoot td {
  border-top: 2px solid var(--border);
  border-bottom: 0;
  background: var(--surface-alt);
  font-weight: 600;
  color: var(--ink-strong);
}

tbody tr:hover td {
  background: var(--canvas);
}

.empty-cell {
  color: var(--faint);
}
</style>
