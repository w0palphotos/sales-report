<script setup>
defineProps({
  value: { type: Object, required: true },
  meta: { type: Object, default: null },
  index: { type: Number, required: true },
});

const emit = defineEmits(['update', 'remove']);

function patch(patchObject) {
  emit('update', patchObject);
}
</script>

<template>
  <div class="value-row">
    <select :value="value.field" @change="patch({ field: $event.target.value })">
      <option v-for="measure in meta?.measures ?? []" :key="measure.key" :value="measure.key">
        {{ measure.label }}
      </option>
    </select>
    <select :value="value.aggregation" @change="patch({ aggregation: $event.target.value })">
      <option v-for="aggregation in meta?.aggregations ?? []" :key="aggregation.key" :value="aggregation.key">
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
