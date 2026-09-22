<script setup>
import { computed } from 'vue';
import DropdownSelect from './DropdownSelect.vue';

const props = defineProps({
  filter: { type: Object, required: true },
  meta: { type: Object, default: null },
  index: { type: Number, required: true },
});

const emit = defineEmits(['update', 'remove']);

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

const valueOptions = computed(() =>
  fieldValues.value.map((value) => ({ value, label: value })),
);

// Operator implisit '=' untuk semua filter; tidak ada lagi dropdown operator.
// Peninggalan 'between' (value array) dinormalisasi ke nilai tunggal.
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
      v-if="field?.type === 'text' && fieldValues.length > 0"
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
  grid-template-columns: 1fr 1.2fr auto;
  gap: 8px;
  align-items: end;
}
</style>
