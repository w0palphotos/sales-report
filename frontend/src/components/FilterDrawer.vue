<script setup>
import FilterBuilder from './FilterBuilder.vue';

defineProps({
  filters: { type: Array, default: () => [] },
  meta: { type: Object, default: null },
});

const emit = defineEmits(['update', 'remove', 'add']);
</script>

<template>
  <div class="sheet-drawer">
    <div class="drawer-head">
      <span class="sheet-label">Filter Kondisi</span>
      <button type="button" class="btn btn-ghost btn-small" @click="emit('add')">+ Tambah Filter</button>
    </div>
    <div class="drawer-list">
      <FilterBuilder
        v-for="(filter, index) in filters"
        :key="index"
        :filter="filter"
        :meta="meta"
        :index="index"
        @update="emit('update', index, $event)"
        @remove="emit('remove', index)"
      />
    </div>
  </div>
</template>

<style scoped>
.sheet-drawer {
  padding: 12px 14px;
  background: var(--surface, #ffffff);
  border-bottom: 1px solid var(--border, #e5e5e3);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.drawer-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
