<script setup>
import { computed } from 'vue';
import DropdownSelect from './DropdownSelect.vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  aggregations: { type: Array, default: () => [] },
  fieldType: { type: String, default: 'number' },
});

const emit = defineEmits(['update:modelValue']);

const eligible = computed(() =>
  props.aggregations.filter(
    (aggregation) => !aggregation.allowedTypes || aggregation.allowedTypes.includes(props.fieldType),
  ),
);

// Agregasi tersembunyi (mis. "Jumlah" = COUNT DISTINCT, default untuk field teks)
// tidak ditawarkan di dropdown; labelnya tetap tampil lewat `displayLabel`.
const options = computed(() =>
  eligible.value
    .filter((aggregation) => !aggregation.hidden)
    .map((aggregation) => ({ value: aggregation.key, label: aggregation.label })),
);

const selectedLabel = computed(() => {
  const current = eligible.value.find((aggregation) => aggregation.key === props.modelValue);
  const listed = options.value.some((option) => option.value === props.modelValue);
  return current && !listed ? current.label : '';
});

function onChange(value) {
  // Nilai kosong bukan agregasi: backend menolaknya sebagai
  // "Perhitungan tidak dikenal". Abaikan saja daripada mengirim null.
  if (!value) return;
  emit('update:modelValue', value);
}
</script>

<template>
  <DropdownSelect
    v-if="options.length > 0"
    :model-value="modelValue ?? ''"
    :options="options"
    :display-label="selectedLabel"
    placeholder="Perhitungan"
    aria-label="Pilih perhitungan"
    @update:model-value="onChange"
  />
</template>

<style scoped>
:deep(.dd) {
  min-width: 120px;
}
</style>
