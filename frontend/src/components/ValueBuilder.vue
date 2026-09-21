<script setup>
import { computed } from 'vue';
import AggregationSelect from './AggregationSelect.vue';

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
    <AggregationSelect
      :model-value="value.aggregation"
      :aggregations="meta?.aggregations ?? []"
      :field-type="currentField?.type ?? 'number'"
      :field-label="currentField?.label ?? ''"
      @update:model-value="patch({ aggregation: $event })"
    />

    <button
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
