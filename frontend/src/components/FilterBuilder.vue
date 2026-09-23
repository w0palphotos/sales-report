<script setup>
import { computed } from 'vue';
import DropdownSelect from './DropdownSelect.vue';

const props = defineProps({
  filter: { type: Object, required: true },
  meta: { type: Object, default: null },
  index: { type: Number, required: true },
});

const emit = defineEmits(['update', 'remove']);

// Label ringkas untuk operator; kalau tidak ada di sini, pakai label dari meta.
const OPERATOR_LABELS = {
  '=': '=',
  '!=': '≠',
  '>': '>',
  '<': '<',
  '>=': '≥',
  '<=': '≤',
  contains: 'mengandung',
};

const toNumber = (value) =>
  value === '' || value == null || Number.isNaN(Number(value)) ? '' : Number(value);

const field = computed(() => {
  if (!props.filter.field) return null;
  return (
    (props.meta?.dimensions ?? []).find((dimension) => dimension.key === props.filter.field) ??
    (props.meta?.measures ?? []).find((measure) => measure.key === props.filter.field)
  );
});

const fieldValues = computed(() => field.value?.values ?? []);

const fieldOptions = computed(() => [
  ...(props.meta?.dimensions ?? []).map((dimension) => ({
    value: dimension.key,
    label: dimension.label,
  })),
  ...(props.meta?.measures ?? []).map((measure) => ({
    value: measure.key,
    label: measure.label,
  })),
]);

// Operator satu argumen saja yang dipakai UI; 'between' butuh dua nilai.
const operatorOptions = computed(() =>
  (props.meta?.operators ?? [])
    .filter((operator) => operator.argCount === 1)
    .map((operator) => ({
      value: operator.key,
      label: OPERATOR_LABELS[operator.key] ?? operator.label,
    })),
);

const operator = computed(() => props.filter.operator ?? '=');

// Nilai yang sudah dikenal hanya relevan untuk perbandingan sama/tidak sama.
const usesValueList = computed(
  () =>
    field.value?.type === 'text' &&
    (operator.value === '=' || operator.value === '!=') &&
    fieldValues.value.length > 0,
);

const valueOptions = computed(() =>
  fieldValues.value.map((value) => ({ value, label: value })),
);

// Operator implisit '=' untuk filter tanpa operator (laporan lama).
const singleValue = computed(() =>
  Array.isArray(props.filter.value) ? (props.filter.value[0] ?? '') : props.filter.value,
);

function patch(patchObject) {
  emit('update', patchObject);
}

function onFieldChange(value) {
  patch({ field: value, value: '' });
}
</script>

<template>
  <div class="filter-row">
    <DropdownSelect
      :model-value="filter.field"
      :options="fieldOptions"
      placeholder="Field"
      aria-label="Pilih field filter"
      @update:model-value="onFieldChange"
    />

    <DropdownSelect
      :model-value="operator"
      :options="operatorOptions"
      placeholder="Operator"
      aria-label="Pilih operator filter"
      @update:model-value="patch({ operator: $event })"
    />

    <DropdownSelect
      v-if="usesValueList"
      :model-value="singleValue"
      :options="valueOptions"
      placeholder="Pilih nilai"
      aria-label="Pilih nilai filter"
      @update:model-value="patch({ value: $event })"
    />

    <input
      v-else-if="field?.type === 'text'"
      type="text"
      :value="singleValue"
      placeholder="Teks"
      @input="patch({ value: $event.target.value })"
    />

    <input
      v-else
      type="number"
      :value="singleValue"
      placeholder="Angka"
      @input="patch({ value: toNumber($event.target.value) })"
    />

    <button type="button" class="btn-icon" :aria-label="`Hapus filter ${index + 1}`" @click="emit('remove')">
      <span aria-hidden="true">&times;</span>
    </button>
  </div>
</template>

<style scoped>
.filter-row {
  display: grid;
  grid-template-columns: 1fr auto 1.2fr auto;
  gap: 8px;
  align-items: end;
}
</style>
