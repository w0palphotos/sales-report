<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  aggregations: { type: Array, default: () => [] },
  fieldType: { type: String, default: 'number' },
  fieldLabel: { type: String, default: '' },
  allowNone: { type: Boolean, default: false },
  noneLabel: { type: String, default: '(None)' },
});

const emit = defineEmits(['update:modelValue']);

const options = computed(() => {
  const valid = props.aggregations
    .filter((agg) => {
      if (!agg.allowedTypes) return true;
      return agg.allowedTypes.includes(props.fieldType);
    })
    .map((agg) => ({
      ...agg,
      label: props.fieldType === 'text' && agg.key === 'count' && props.fieldLabel
        ? `Jumlah ${props.fieldLabel}`
        : agg.label,
    }));
  return props.allowNone ? [{ key: '', label: props.noneLabel }, ...valid] : valid;
});

function onChange(event) {
  emit('update:modelValue', event.target.value || null);
}
</script>

<template>
  <select class="aggregation-select" :value="modelValue ?? ''" @change="onChange">
    <option v-for="option in options" :key="option.key" :value="option.key">
      {{ option.label }}
    </option>
  </select>
</template>

<style scoped>
.aggregation-select {
  min-width: 120px;
}
</style>
