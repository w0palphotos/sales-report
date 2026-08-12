<script setup>
import { computed } from 'vue';

const props = defineProps({
  reports: { type: Array, default: () => [] },
});

const emit = defineEmits(['load', 'delete']);

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

const hasReports = computed(() => props.reports.length > 0);
</script>

<template>
  <section v-if="hasReports" class="card saved-card">
    <div class="saved-head">
      <h3>Laporan tersimpan</h3>
      <span class="tag tag-ink">{{ reports.length }}</span>
    </div>
    <ul class="saved-list">
      <li v-for="report in reports" :key="report.id" class="saved-item">
        <div class="saved-info">
          <span class="saved-name">{{ report.name }}</span>
          <span class="saved-date">{{ formatDate(report.created_at) }}</span>
        </div>
        <div class="saved-actions">
          <button type="button" class="btn btn-secondary btn-small" @click="emit('load', report)">
            Muat
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-small"
            :aria-label="`Hapus ${report.name}`"
            @click="emit('delete', report.id)"
          >
            Hapus
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.saved-card {
  padding: 28px 32px;
}

.saved-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.saved-head h3 {
  font-size: 22px;
}

.saved-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.saved-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid var(--border);
}

.saved-item:last-child {
  border-bottom: 0;
}

.saved-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.saved-name {
  font-weight: 500;
  color: var(--ink-strong);
}

.saved-date {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--muted);
}

.saved-actions {
  display: flex;
  gap: 8px;
}
</style>
