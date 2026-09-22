<script setup>
import { computed } from 'vue';
import DropdownSelect from './DropdownSelect.vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  aggregations: { type: Array, default: () => [] },
  fieldType: { type: String, default: 'number' },
  fieldLabel: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue']);

const options = computed(() =>
  props.aggregations
    .filter((agg) => !agg.allowedTypes || agg.allowedTypes.includes(props.fieldType))
    .map((agg) => ({
      value: agg.key,
      label:
        props.fieldType === 'text' && agg.key === 'count' && props.fieldLabel
          ? `Jumlah ${props.fieldLabel}`
          : agg.label,
    })),
);

function onChange(value) {
  emit('update:modelValue', value || null);
}
</script>

<template>
  <DropdownSelect
    :model-value="modelValue ?? ''"
    :options="options"
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
