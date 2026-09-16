<script setup>
import { computed } from 'vue';

const props = defineProps({
  value: { type: Object, required: true },
  meta: { type: Object, default: null },
  index: { type: Number, required: true },
});

const emit = defineEmits(['update', 'remove']);

function patch(patchObject) {
  emit('update', patchObject);
}

const currentField = computed(() => {
  return (props.meta?.measures ?? []).find((m) => m.key === props.value.field);
});

const availableAggregations = computed(() => {
  const isText = currentField.value?.type === 'text';
  return (props.meta?.aggregations ?? []).filter((agg) => {
    if (isText) {
      return agg.allowedTypes ? agg.allowedTypes.includes('text') : agg.key === 'count';
    }
    return true;
  });
});

function onFieldChange(event) {
  const newFieldKey = event.target.value;
  if (!newFieldKey) {
    emit('remove');
    return;
  }
  const targetField = (props.meta?.measures ?? []).find((m) => m.key === newFieldKey);
  const isText = targetField?.type === 'text';

  if (isText && props.value.aggregation !== 'count') {
    patch({ field: newFieldKey, aggregation: 'count' });
  } else {
    patch({ field: newFieldKey });
  }
}
</script>

<template>
  <div class="value-row">
    <select :value="value.field" @change="onFieldChange">
      <option value="">(Tanpa Nilai)</option>
      <option v-for="measure in meta?.measures ?? []" :key="measure.key" :value="measure.key">
        {{ measure.label }}
      </option>
    </select>
    <select :value="value.aggregation" @change="patch({ aggregation: $event.target.value })">
      <option v-for="aggregation in availableAggregations" :key="aggregation.key" :value="aggregation.key">
        {{ aggregation.label }}
      </option>
    </select>
    <button
      v-if="index > 0"
      type="button"
      class="chip-remove"
      :aria-label="`Hapus nilai ${index + 1}`"
      @click="emit('remove')"
    >
      &times;
    </button>
  </div>
</template>

<style scoped>
.value-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
