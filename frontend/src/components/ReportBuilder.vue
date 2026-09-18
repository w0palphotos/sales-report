<script setup>
import { onMounted, ref } from 'vue';
import { api } from '../api/client.js';
import { MAX_BLOCKS, useDashboard } from '../composables/useDashboard.js';
import RawDataTable from './RawDataTable.vue';
import ReportBlock from './ReportBlock.vue';
import SavedReports from './SavedReports.vue';

const {
  blocks,
  savedReports,
  error,
  canAdd,
  init,
  addBlankBlock,
  appendBlock,
  removeBlock,
  toggleBlockChart,
  renameBlock,
  deleteSaved,
} = useDashboard();

const rawSales = ref([]);
const rawLoading = ref(false);

async function loadRawSales() {
  rawLoading.value = true;
  try {
    const res = await api.listSales();
    rawSales.value = res?.sales ?? [];
  } catch (err) {
    console.error('Failed to load raw sales', err);
  } finally {
    rawLoading.value = false;
  }
}

function handleLoad(report) {
  appendBlock(report.config, report.name);
}

onMounted(async () => {
  await Promise.all([init(), loadRawSales()]);
});
</script>

<template>
  <div class="container builder-container">
    <RawDataTable :sales="rawSales" />

    <div v-if="error" class="error-banner" role="alert">{{ error }}</div>

    <ReportBlock
      v-for="(block, index) in blocks"
      :key="block.id"
      :block="block"
      :index="index"
      @remove="removeBlock(block.id)"
      @toggle-chart="toggleBlockChart(block.id)"
      @rename="(title) => renameBlock(block.id, title)"
    />

    <div class="add-block-row">
      <button v-if="canAdd" type="button" class="btn btn-secondary" @click="addBlankBlock()">
        + Tambah tabel
      </button>
      <p v-else class="add-block-hint">Maksimal {{ MAX_BLOCKS }} blok laporan.</p>
    </div>

    <div class="saved-section">
      <SavedReports :reports="savedReports" @load="handleLoad" @delete="deleteSaved" />
    </div>
  </div>
</template>

<style scoped>
.builder-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: var(--pad-section, 64px);
}

.add-block-row {
  display: flex;
  justify-content: center;
  padding: 4px 0;
}

.add-block-hint {
  font-size: 13px;
  color: var(--muted, #787774);
}

.error-banner {
  background: var(--pastel-red-bg);
  color: var(--pastel-red);
  border: 1px solid rgba(159, 47, 45, 0.18);
  border-radius: var(--radius);
  padding: 12px 16px;
  font-size: 14px;
}

.saved-section {
  padding-top: 8px;
}
</style>
