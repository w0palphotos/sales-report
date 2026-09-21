<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { DEFAULT_TEXT, normalizeHex } from '../utils/cellStyle.js';
import { FILL_PALETTE, DEFAULT_TABLE_STYLE } from '../utils/tablePresets.js';

const props = defineProps({
  options: { type: Array, default: () => [] },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  error: { type: String, default: '' },
});

const emit = defineEmits(['save', 'remove', 'reset', 'preview', 'close']);

const targetKind = ref(props.options[0]?.kind ?? 'category');
const targetKey = ref(props.options[0]?.key ?? props.options[0]?.value ?? null);

const currentOption = computed(() =>
  props.options.find((opt) =>
    opt.kind === targetKind.value &&
    (opt.kind === 'category' ? opt.value === targetKey.value : opt.key === targetKey.value),
  ) ?? props.options[0] ?? null,
);

const bg = ref(
  currentOption.value?.globalRule?.bg ??
    currentOption.value?.overrideRule?.bg ??
    DEFAULT_TABLE_STYLE.body,
);
const color = ref(
  currentOption.value?.globalRule?.color ??
    currentOption.value?.overrideRule?.color ??
    DEFAULT_TEXT,
);
const scope = ref(currentOption.value?.overrideRule ? 'report' : 'global');

// Pewarnaan per sel hanya berlaku untuk laporan ini (tidak masuk aturan global).
const scopeLocked = computed(() => targetKind.value === 'cell');

function applySwatch(swatch) {
  bg.value = swatch.bg;
  color.value = swatch.color ?? DEFAULT_TEXT;
}

// Nilai untuk <input type="color"> selalu perlu format #rrggbb.
const bgPicker = computed(() => normalizeHex(bg.value) ?? '#ffffff');
const colorPicker = computed(() => normalizeHex(color.value) ?? DEFAULT_TEXT);

// Hex manual: terima #rgb / #rrggbb. Input tidak valid dikembalikan ke nilai aktif.
function onHexChange(target, event) {
  const hex = normalizeHex(event.target.value);
  if (hex) {
    if (target === 'bg') bg.value = hex;
    else color.value = hex;
    event.target.value = hex;
    return;
  }
  event.target.value = target === 'bg' ? bg.value : color.value;
}

watch(scopeLocked, (locked) => {
  if (locked) scope.value = 'report';
});

watch(targetKind, () => {
  const opt =
    props.options.find((o) => o.kind === targetKind.value) ?? props.options[0] ?? null;
  if (opt) {
    targetKey.value = opt.kind === 'category' ? opt.value : opt.key;
    bg.value = opt.globalRule?.bg ?? opt.overrideRule?.bg ?? DEFAULT_TABLE_STYLE.body;
    color.value = opt.globalRule?.color ?? opt.overrideRule?.color ?? DEFAULT_TEXT;
    scope.value = scopeLocked.value ? 'report' : (opt.overrideRule ? 'report' : 'global');
  }
});

watch(targetKey, () => {
  const opt =
    props.options.find((o) =>
      o.kind === targetKind.value &&
      (o.kind === 'category' ? o.value === targetKey.value : o.key === targetKey.value),
    ) ?? null;
  if (opt) {
    bg.value = opt.globalRule?.bg ?? opt.overrideRule?.bg ?? bg.value;
    color.value = opt.globalRule?.color ?? opt.overrideRule?.color ?? color.value;
  }
});

// Preview langsung ke tabel tiap warna berubah, sebelum disimpan.
watch([bg, color, targetKind, targetKey], () => emit('preview', currentPayload()));

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

function currentPayload() {
  const opt = currentOption.value ?? {};
  return {
    kind: targetKind.value,
    key: opt.kind === 'category' ? null : opt.key,
    field: opt.field ?? null,
    value: opt.value ?? null,
    scope: scope.value,
    bg: bg.value,
    color: color.value,
  };
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
      class="color-popover"
      :style="{ left: pos.left + 'px', top: pos.top + 'px' }"
      @mousedown.stop
    >
      <div class="popover-title">Atur warna</div>

      <p v-if="error" class="popover-error" role="alert">{{ error }}</p>

      <div class="popover-scope">
        <label v-for="opt in options" :key="opt.kind + ':' + (opt.key ?? opt.value)">
          <input
            :value="opt.kind === 'category' ? opt.value : opt.key"
            :checked="
              targetKind === opt.kind &&
              (opt.kind === 'category' ? opt.value === targetKey : opt.key === targetKey)
            "
            type="radio"
            name="color-target"
            @change="
              targetKind = opt.kind;
              targetKey = opt.kind === 'category' ? opt.value : opt.key;
            "
          />
          {{ opt.label }}
        </label>
      </div>

      <div class="popover-row">
        <span
          v-if="currentOption?.globalRule"
          class="mini-swatch"
          title="Aturan global"
          :style="{
            background: currentOption.globalRule.bg,
            color: currentOption.globalRule.color || '#2f3437',
          }"
        >
          G
        </span>
        <span
          v-if="currentOption?.overrideRule"
          class="mini-swatch"
          title="Override laporan ini"
          :style="{
            background: currentOption.overrideRule.bg,
            color: currentOption.overrideRule.color || '#2f3437',
          }"
        >
          L
        </span>
        <span
          v-if="!currentOption?.globalRule && !currentOption?.overrideRule"
          class="popover-hint"
        >
          Belum ada warna.
        </span>
      </div>

      <div class="picker-section">
        <span class="picker-label">Latar</span>
        <div class="popover-palette">
          <button
            v-for="sw in FILL_PALETTE"
            :key="sw.bg"
            type="button"
            class="palette-swatch"
            :title="sw.label"
            :style="{ background: sw.bg }"
            @click="applySwatch(sw)"
          />
        </div>
        <div class="picker-custom">
          <input
            class="picker-native"
            type="color"
            :value="bgPicker"
            aria-label="Pilih warna latar"
            @input="bg = $event.target.value"
          />
          <input
            class="picker-hex"
            type="text"
            maxlength="7"
            spellcheck="false"
            :value="bg"
            aria-label="Kode hex latar"
            @change="onHexChange('bg', $event)"
          />
        </div>
      </div>

      <div class="picker-section">
        <span class="picker-label">Teks</span>
        <div class="picker-custom">
          <input
            class="picker-native"
            type="color"
            :value="colorPicker"
            aria-label="Pilih warna teks"
            @input="color = $event.target.value"
          />
          <input
            class="picker-hex"
            type="text"
            maxlength="7"
            spellcheck="false"
            :value="color"
            aria-label="Kode hex teks"
            @change="onHexChange('color', $event)"
          />
        </div>
      </div>

      <div v-if="scopeLocked" class="popover-hint">
        Warna per sel hanya untuk laporan ini.
      </div>
      <div v-else class="popover-scope">
        <label>
          <input v-model="scope" type="radio" value="global" />
          Global (semua laporan)
        </label>
        <label>
          <input v-model="scope" type="radio" value="report" />
          Laporan ini saja
        </label>
      </div>

      <div class="popover-actions">
        <button
          type="button"
          class="btn btn-secondary btn-small"
          @click="emit('save', currentPayload())"
        >
          Simpan
        </button>
        <button
          v-if="currentOption?.globalRule || currentOption?.overrideRule"
          type="button"
          class="btn btn-ghost btn-small"
          @click="emit('remove', currentPayload())"
        >
          Hapus warna
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-small"
          title="Hapus semua warna laporan ini dan global"
          @click="emit('reset')"
        >
          Reset warna
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

.color-popover {
  position: fixed;
  z-index: 201;
  width: 248px;
  padding: 12px 14px;
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #e5e5e3);
  border-radius: var(--radius, 8px);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.14);
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
}

.popover-title {
  font-size: 13px;
  font-weight: 700;
}

.popover-error {
  margin: 0;
  font-size: 12px;
  color: var(--pastel-red, #9f2f2d);
  background: var(--pastel-red-bg);
  border-radius: var(--radius-sm, 4px);
  padding: 6px 8px;
}

.popover-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.popover-hint {
  font-size: 12px;
  color: var(--muted, #787774);
}

.popover-palette {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.palette-swatch {
  width: 20px;
  height: 20px;
  padding: 0;
  border-radius: 4px;
  border: 1px solid var(--border, #e5e5e3);
  cursor: pointer;
}

.palette-swatch:hover {
  outline: 2px solid var(--border-strong, #999);
}

.mini-swatch {
  display: inline-block;
  width: 22px;
  height: 22px;
  line-height: 22px;
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  border-radius: 6px;
  border: 1px solid var(--border, #e5e5e3);
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

.picker-custom {
  display: flex;
  align-items: center;
  gap: 8px;
}

.picker-native {
  width: 36px;
  height: 28px;
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

.popover-scope {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.popover-scope label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.popover-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
