<script setup>
import { computed } from 'vue';
import DropdownSelect from './DropdownSelect.vue';
import ValueBuilder from './ValueBuilder.vue';

const props = defineProps({
  config: { type: Object, required: true },
  meta: { type: Object, default: null },
  running: { type: Boolean, default: false },
  hasResult: { type: Boolean, default: false },
  showFilters: { type: Boolean, default: false },
});

const emit = defineEmits([
  'set-row',
  'remove-row',
  'add-row',
  'set-column',
  'clear-column',
  'update-value',
  'remove-value',
  'add-value',
  'toggle-filters',
  'export',
  'toggle-save',
  'reset',
]);

const dimensions = computed(() => props.meta?.dimensions ?? []);

const rowOptionsFor = (index) =>
  dimensions.value
    .filter((dimension) => {
      const used = new Set(props.config.rows.filter((_, j) => j !== index));
      props.config.columns.forEach((column) => used.add(column));
      return !used.has(dimension.key);
    })
    .map((dimension) => ({ value: dimension.key, label: dimension.label }));

const columnOptionsFor = () =>
  dimensions.value
    .filter((dimension) => {
      const used = new Set(props.config.rows);
      return !used.has(dimension.key) || dimension.key === props.config.columns[0];
    })
    .map((dimension) => ({ value: dimension.key, label: dimension.label }));
</script>

<template>
  <div class="sheet-toolbar">
    <div class="sheet-controls">
      <span class="sheet-title-badge">Pivot Table</span>

      <!-- Rows -->
      <div class="sheet-control-group">
        <span class="sheet-label">Baris:</span>
        <div v-for="(row, index) in config.rows" :key="'row-' + index" class="sheet-select-wrap">
          <DropdownSelect
            :model-value="row"
            :options="rowOptionsFor(index)"
            placeholder="(Tanpa Baris)"
            :allow-clear="true"
            aria-label="Pilih dimensi baris"
            @update:model-value="emit('set-row', index, $event)"
          />
          <button
            type="button"
            class="chip-remove"
            :aria-label="`Hapus baris ${index + 1}`"
            @click="emit('remove-row', index)"
          >
            &times;
          </button>
        </div>
        <button
          v-if="config.rows.length < 3"
          type="button"
          class="btn btn-ghost btn-small"
          title="Tambah baris"
          @click="emit('add-row')"
        >
          +
        </button>
      </div>

      <div class="sheet-divider"></div>

      <!-- Columns -->
      <div class="sheet-control-group">
        <span class="sheet-label">Kolom:</span>
        <div class="sheet-select-wrap">
          <DropdownSelect
            :model-value="config.columns[0] ?? ''"
            :options="columnOptionsFor()"
            placeholder="(Tanpa Kolom)"
            :allow-clear="true"
            aria-label="Pilih dimensi kolom"
            @update:model-value="$event ? emit('set-column', $event) : emit('clear-column')"
          />
          <button
            v-if="config.columns.length"
            type="button"
            class="chip-remove"
            aria-label="Bersihkan kolom"
            @click="emit('clear-column')"
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
            @update="emit('update-value', index, $event)"
            @remove="emit('remove-value', index)"
          />
        </div>
        <button
          v-if="config.values.length < 8"
          type="button"
          class="btn btn-ghost btn-small"
          title="Tambah nilai"
          @click="emit('add-value')"
        >
          +
        </button>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="sheet-actions">
      <span v-if="running" class="sheet-label" style="margin-right: 8px;">Memproses…</span>
      <button
        type="button"
        class="btn btn-ghost btn-small"
        :class="{ active: showFilters || config.filters.length > 0 }"
        @click="emit('toggle-filters')"
      >
        Filter {{ config.filters.length > 0 ? `(${config.filters.length})` : '' }}
      </button>
      <button
        type="button"
        class="btn btn-secondary btn-small"
        :disabled="!hasResult"
        @click="emit('export')"
      >
        Export XLSX
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-small"
        :disabled="!hasResult"
        @click="emit('toggle-save')"
      >
        Simpan
      </button>
      <button type="button" class="btn btn-ghost btn-small" @click="emit('reset')">
        Reset
      </button>
    </div>
  </div>
</template>

<style scoped>
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

@media (max-width: 768px) {
  .sheet-actions {
    margin-left: 0;
    width: 100%;
  }
}
</style>
