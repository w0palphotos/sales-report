<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { DEFAULT_TEXT, normalizeHex } from '../utils/cellStyle.js';
import { TABLE_PRESETS, DEFAULT_TABLE_STYLE, resolveTheme } from '../utils/tablePresets.js';

const props = defineProps({
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  current: { type: [String, Object], default: null },
});

const emit = defineEmits(['apply', 'close']);

const builtins = TABLE_PRESETS.filter((preset) => preset.key !== 'none');
const base = resolveTheme(props.current);

const header = ref(normalizeHex(props.current?.header) ?? base.header);
const body = ref(normalizeHex(props.current?.body) ?? base.body);
const color = ref(normalizeHex(props.current?.color) ?? DEFAULT_TABLE_STYLE.color);

const headerPicker = computed(() => normalizeHex(header.value) ?? DEFAULT_TABLE_STYLE.header);
const bodyPicker = computed(() => normalizeHex(body.value) ?? DEFAULT_TABLE_STYLE.body);
const colorPicker = computed(() => normalizeHex(color.value) ?? DEFAULT_TEXT);

function onHexChange(target, event) {
  const hex = normalizeHex(event.target.value);
  const refs = { header, body, color };
  const current = refs[target];
  if (!current) return;
  if (hex) current.value = hex;
  event.target.value = current.value;
}

const panel = ref(null);
const pos = ref({ left: props.x, top: props.y });

function clampPosition() {
  const el = panel.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  pos.value = {
    left: Math.max(8, Math.min(props.x, window.innerWidth - rect.width - 8)),
    top: Math.max(8, Math.min(props.y, window.innerHeight - rect.height - 8)),
  };
}

function onKeydown(event) {
  if (event.key === 'Escape') emit('close');
}

onMounted(async () => {
  await nextTick();
  clampPosition();
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div class="popover-overlay" @mousedown="emit('close')">
    <div
      ref="panel"
      class="preset-popover"
      :style="{ left: pos.left + 'px', top: pos.top + 'px' }"
      @mousedown.stop
    >
      <div class="popover-title">Preset warna tabel</div>

      <div class="preset-grid">
        <button
          v-for="preset in builtins"
          :key="preset.key"
          type="button"
          class="preset-card"
          :title="preset.label"
          @click="emit('apply', preset.key)"
        >
          <span class="preset-header" :style="{ background: preset.header }" />
          <span class="preset-body" :style="{ background: preset.body }" />
          <span class="preset-name">{{ preset.label }}</span>
        </button>
      </div>

      <div class="picker-section">
        <span class="picker-label">Kustom</span>
        <label class="picker-row">
          <span class="picker-name">Header</span>
          <input
            class="picker-native"
            type="color"
            :value="headerPicker"
            aria-label="Warna header"
            @input="header = $event.target.value"
          />
          <input
            class="picker-hex"
            type="text"
            maxlength="7"
            spellcheck="false"
            :value="header"
            @change="onHexChange('header', $event)"
          />
        </label>
        <label class="picker-row">
          <span class="picker-name">Badan</span>
          <input
            class="picker-native"
            type="color"
            :value="bodyPicker"
            aria-label="Warna badan"
            @input="body = $event.target.value"
          />
          <input
            class="picker-hex"
            type="text"
            maxlength="7"
            spellcheck="false"
            :value="body"
            @change="onHexChange('body', $event)"
          />
        </label>
        <label class="picker-row">
          <span class="picker-name">Teks</span>
          <input
            class="picker-native"
            type="color"
            :value="colorPicker"
            aria-label="Warna teks"
            @input="color = $event.target.value"
          />
          <input
            class="picker-hex"
            type="text"
            maxlength="7"
            spellcheck="false"
            :value="color"
            @change="onHexChange('color', $event)"
          />
        </label>
      </div>

      <div class="popover-actions">
        <button
          type="button"
          class="btn btn-secondary btn-small"
          @click="emit('apply', { header, body, color })"
        >
          Terapkan kustom
        </button>
        <button type="button" class="btn btn-ghost btn-small" @click="emit('apply', 'none')">
          Tanpa preset
        </button>
        <button type="button" class="btn btn-ghost btn-small" @click="emit('close')">
          Batal
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.popover-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
}

.preset-popover {
  position: fixed;
  z-index: 201;
  width: 268px;
  padding: 12px 14px;
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #e5e5e3);
  border-radius: var(--radius, 8px);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.14);
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 13px;
}

.popover-title {
  font-size: 13px;
  font-weight: 700;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.preset-card {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  border: 1px solid var(--border, #e5e5e3);
  border-radius: 6px;
  background: none;
  cursor: pointer;
  overflow: hidden;
}

.preset-card:hover {
  outline: 2px solid var(--border-strong, #999);
}

.preset-header {
  display: block;
  height: 14px;
}

.preset-body {
  display: block;
  height: 14px;
}

.preset-name {
  display: block;
  padding: 2px 0;
  font-size: 11px;
  color: var(--muted, #787774);
}

.picker-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.picker-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-strong, #111111);
}

.picker-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.picker-name {
  width: 54px;
  font-size: 12px;
  color: var(--muted, #787774);
}

.picker-native {
  width: 36px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--border, #e5e5e3);
  border-radius: 6px;
  background: none;
  cursor: pointer;
}

.picker-hex {
  flex: 1;
  min-width: 0;
  font-family: var(--font-mono, monospace);
}

.popover-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
