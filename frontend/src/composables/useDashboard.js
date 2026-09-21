import { computed, ref, watch } from 'vue';
import { api } from '../api/client.js';
import { useReportBuilder } from './useReportBuilder.js';

export const MAX_BLOCKS = 4;

const STORAGE_KEY = 'sales-report-dashboard-v1';

let nextBlockId = 1;

const clone = (value) => JSON.parse(JSON.stringify(value ?? {}));

function cleanTitle(title, fallback) {
  const clean = typeof title === 'string' ? title.trim().slice(0, 80) : '';
  return clean || fallback;
}

// Nomor terkecil yang belum dipakai ("Laporan 1", "Laporan 2", ...),
// dihitung dari judul blok yang ada — bukan counter yang terus naik.
function nextTitle(blocks) {
  const used = new Set(
    blocks
      .map((b) => /^laporan (\d+)$/i.exec(String(b.title ?? '').trim()))
      .filter(Boolean)
      .map((m) => Number(m[1])),
  );
  let n = 1;
  while (used.has(n)) n++;
  return `Laporan ${n}`;
}

function snapshotBlocks(blocks) {
  return blocks.map((block) => ({
    title: block.title,
    showChart: block.showChart,
    config: {
      rows: [...block.builder.config.rows],
      columns: [...block.builder.config.columns],
      values: clone(block.builder.config.values),
      filters: clone(block.builder.config.filters),
      colors: clone(block.builder.config.colors),
      styles: clone(block.builder.config.styles),
      preset: block.builder.config.preset ?? null,
    },
  }));
}

function persistBlocks(blocks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshotBlocks(blocks)));
  } catch {
    // penyimpanan penuh/nonaktif: dashboard tetap jalan sesi ini
  }
}

function restoreItems() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

// Dashboard multi-blok: tiap blok adalah useReportBuilder mandiri
// (factory murni, aman diinstansiasi berkali-kali). Susunan blok
// disimpan di localStorage; backend tidak berubah.
export function useDashboard() {
  const blocks = ref([]);
  const savedReports = ref([]);
  const sharedMeta = ref(null);
  const error = ref(null);

  function createBlock(title = null) {
    const builder = useReportBuilder();
    if (sharedMeta.value) builder.meta.value = sharedMeta.value;
    builder.loadColors();
    builder.loadTableStyles();
    const id = nextBlockId++;
    return { id, title: cleanTitle(title, nextTitle(blocks.value)), builder, showChart: true };
  }

  const persistenceKey = computed(() => JSON.stringify(snapshotBlocks(blocks.value)));

  function addBlankBlock(title = null) {
    if (blocks.value.length >= MAX_BLOCKS) {
      error.value = `Maksimal ${MAX_BLOCKS} blok laporan.`;
      return null;
    }
    error.value = null;
    const block = createBlock(title);
    blocks.value.push(block);
    return block;
  }

  function appendBlock(savedConfig = null, title = null) {
    const block = addBlankBlock(title);
    if (block && savedConfig) block.builder.loadReport({ config: savedConfig });
    return block;
  }

  function removeBlock(id) {
    blocks.value = blocks.value.filter((block) => block.id !== id);
  }

  function toggleBlockChart(id) {
    const block = blocks.value.find((b) => b.id === id);
    if (block) block.showChart = !block.showChart;
  }

  function renameBlock(id, title) {
    const block = blocks.value.find((b) => b.id === id);
    const clean = String(title ?? '').trim().slice(0, 80);
    if (block && clean) block.title = clean;
  }

  async function refreshSaved() {
    try {
      const data = await api.saved.list();
      savedReports.value = data.reports;
    } catch (err) {
      error.value = err.message;
    }
  }

  async function deleteSaved(id) {
    try {
      await api.saved.remove(id);
      await refreshSaved();
    } catch (err) {
      error.value = err.message;
    }
  }

  async function init() {
    try {
      sharedMeta.value = await api.getMeta();
    } catch (err) {
      error.value = err.message;
    }
    await refreshSaved();

    let restored = restoreItems();
    if (restored.length === 0) restored = [null];
    for (const item of restored.slice(0, MAX_BLOCKS)) {
      const block = createBlock(item?.title ?? null);
      if (item?.config) {
        block.showChart = item.showChart !== false;
        block.builder.loadReport({ config: item.config });
      }
      blocks.value.push(block);
    }

    // Simpan susunan setiap ada perubahan konfigurasi blok.
    watch(persistenceKey, () => persistBlocks(blocks.value));
  }

  const canAdd = computed(() => blocks.value.length < MAX_BLOCKS);

  return {
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
    refreshSaved,
    deleteSaved,
  };
}
