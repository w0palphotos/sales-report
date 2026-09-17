<script setup>
import { reactive, watch } from 'vue';
import { DEFAULT_TEXT } from '../utils/cellStyle.js';

const props = defineProps({
  meta: { type: Object, default: null },
  globalColors: { type: Object, default: () => ({}) },
  overrideColors: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['save-global', 'save-override', 'clear-override']);

const working = reactive({});

function initWorking() {
  for (const key of Object.keys(working)) delete working[key];
  for (const [field, vals] of Object.entries(props.globalColors ?? {})) {
    working[field] = {};
    for (const [val, rule] of Object.entries(vals ?? {})) {
      working[field][val] = { bg: rule.bg ?? '#ffffff', color: rule.color ?? DEFAULT_TEXT };
    }
  }
}

initWorking();
watch(() => props.globalColors, initWorking, { deep: true });

function setColor(field, value, patch) {
  if (!working[field]) working[field] = {};
  working[field][value] = {
    bg: '#ffffff',
    color: DEFAULT_TEXT,
    ...(working[field][value] ?? {}),
    ...patch,
  };
}

function resetColor(field, value) {
  if (working[field]?.[value]) delete working[field][value];
}

function toArray() {
  const out = [];
  for (const [field, vals] of Object.entries(working)) {
    for (const [val, rule] of Object.entries(vals ?? {})) {
      if (rule?.bg) out.push({ field, value: val, bg: rule.bg, color: rule.color ?? DEFAULT_TEXT });
    }
  }
  return out;
}

function effectiveBg(field, value) {
  return (
    props.overrideColors?.[field]?.[value]?.bg ?? working[field]?.[value]?.bg ?? '#ffffff'
  );
}
</script>

<template>
  <div class="sheet-drawer">
    <div class="drawer-head">
      <span class="sheet-label">Warna Kategori</span>
      <div class="drawer-actions">
        <button
          type="button"
          class="btn btn-ghost btn-small"
          @click="emit('save-override', JSON.parse(JSON.stringify(working)))"
        >
          Pakai untuk laporan ini
        </button>
        <button type="button" class="btn btn-secondary btn-small" @click="emit('save-global', toArray())">
          Simpan global
        </button>
      </div>
    </div>
    <p class="drawer-hint">
      Aturan global berlaku di semua laporan. "Pakai untuk laporan ini" menimpa global
      khusus laporan aktif dan ikut tersimpan saat laporan disimpan.
    </p>
    <div v-for="dim in meta?.dimensions ?? []" :key="dim.key" class="color-group">
      <span class="color-group-title">{{ dim.label }}</span>
      <div v-for="val in dim.values ?? []" :key="dim.key + '::' + val" class="color-row">
        <span class="color-name">{{ val }}</span>
        <span v-if="overrideColors?.[dim.key]?.[val]" class="override-badge">override</span>
        <input
          type="color"
          title="Warna latar"
          :value="effectiveBg(dim.key, val)"
          @input="setColor(dim.key, val, { bg: $event.target.value })"
        />
        <input
          type="color"
          title="Warna teks"
          :value="working[dim.key]?.[val]?.color ?? '#2f3437'"
          @input="setColor(dim.key, val, { color: $event.target.value })"
        />
        <button
          type="button"
          class="chip-remove"
          :aria-label="`Hapus warna ${val}`"
          @click="resetColor(dim.key, val)"
        >
          &times;
        </button>
      </div>
    </div>
    <button
      v-if="overrideColors && Object.keys(overrideColors).length > 0"
      type="button"
      class="btn btn-ghost btn-small"
      @click="emit('clear-override')"
    >
      Hapus override laporan ini
    </button>
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
  gap: 8px;
  flex-wrap: wrap;
}

.drawer-actions {
  display: flex;
  gap: 6px;
}

.drawer-hint {
  font-size: 12px;
  color: var(--muted, #787774);
  margin: 0;
}

.color-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.color-group-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-strong, #111111);
}

.color-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-name {
  min-width: 140px;
  font-size: 13px;
}

.override-badge {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 1px 6px;
  border: 1px solid var(--border, #e5e5e3);
  border-radius: 999px;
  color: var(--muted, #787774);
}
</style>
