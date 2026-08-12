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
    <button type="button" class="btn-icon" :aria-label="`Hapus nilai ${index + 1}`" @click="emit('remove')">
      <span aria-hidden="true">&times;</span>
    </button>
  </div>
</template>

<style scoped>
.value-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 8px;
  align-items: end;
}
</style>
