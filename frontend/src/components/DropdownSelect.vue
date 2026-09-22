<script setup>
import { computed, nextTick, onUnmounted, ref } from 'vue';

// Dropdown pengganti <select> bawaan. Popup select native di Linux (Chromium)
// dibuka saat mousedown lalu batal saat mouseup pada klik yang sama, sehingga
// pilihan baru terpilih kalau tombol kiri ditahan sambil digeser ke opsinya.
// Komponen ini memakai menu sendiri supaya satu klik biasa langsung memilih.
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Pilih' },
  disabled: { type: Boolean, default: false },
  allowClear: { type: Boolean, default: false },
  ariaLabel: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue']);

let seq = 0;

const uid = `dd-${(seq += 1)}-${Math.random().toString(36).slice(2, 7)}`;

const open = ref(false);
const activeIndex = ref(-1);
const root = ref(null);
const menu = ref(null);
const pos = ref({ left: 0, top: 0, width: 0 });

const items = computed(() =>
  props.allowClear
    ? [{ value: '', label: props.placeholder }, ...props.options]
    : props.options,
);

const selectedIndex = computed(() =>
  items.value.findIndex((item) => String(item.value) === String(props.modelValue ?? '')),
);

const currentLabel = computed(
  () => items.value[selectedIndex.value]?.label ?? props.placeholder,
);

function isSelected(item) {
  return String(item.value) === String(props.modelValue ?? '');
}

function placeMenu() {
  const el = root.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const width = Math.max(rect.width, 160);
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  let top = rect.bottom + 4;
  const height = menu.value?.offsetHeight ?? 0;
  if (height && top + height > window.innerHeight - 8) {
    top = Math.max(8, rect.top - height - 4);
  }
  pos.value = { left, top, width };
}

function onDocMousedown(event) {
  if (root.value && !root.value.contains(event.target)) closeMenu();
}

function bindGlobal() {
  document.addEventListener('mousedown', onDocMousedown, true);
  window.addEventListener('resize', closeMenu);
  window.addEventListener('scroll', closeMenu, true);
}

function unbindGlobal() {
  document.removeEventListener('mousedown', onDocMousedown, true);
  window.removeEventListener('resize', closeMenu);
  window.removeEventListener('scroll', closeMenu, true);
}

async function openMenu() {
  if (props.disabled || open.value) return;
  open.value = true;
  activeIndex.value = selectedIndex.value;
  bindGlobal();
  await nextTick();
  placeMenu();
}

function closeMenu() {
  if (!open.value) return;
  open.value = false;
  activeIndex.value = -1;
  unbindGlobal();
}

function toggle() {
  if (open.value) closeMenu();
  else openMenu();
}

function select(item) {
  if (!item) return;
  emit('update:modelValue', item.value);
  closeMenu();
}

function moveActive(delta) {
  const total = items.value.length;
  if (total === 0) return;
  const next = activeIndex.value + delta;
  activeIndex.value = (next + total) % total;
}

function onKeydown(event) {
  if (props.disabled) return;
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      open.value ? moveActive(1) : openMenu();
      break;
    case 'ArrowUp':
      event.preventDefault();
      open.value ? moveActive(-1) : openMenu();
      break;
    case 'Home':
      if (open.value) {
        event.preventDefault();
        activeIndex.value = 0;
      }
      break;
    case 'End':
      if (open.value) {
        event.preventDefault();
        activeIndex.value = items.value.length - 1;
      }
      break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      if (!open.value) openMenu();
      else if (activeIndex.value >= 0) select(items.value[activeIndex.value]);
      break;
    case 'Escape':
      if (open.value) {
        event.preventDefault();
        closeMenu();
      }
      break;
    case 'Tab':
      closeMenu();
      break;
  }
}

onUnmounted(unbindGlobal);
</script>

<template>
  <div ref="root" class="dd">
    <button
      type="button"
      class="dd-trigger"
      :class="{ 'is-open': open }"
      :disabled="disabled"
      :aria-label="ariaLabel || undefined"
      aria-haspopup="listbox"
      :aria-expanded="open ? 'true' : 'false'"
      :aria-controls="`${uid}-listbox`"
      :aria-activedescendant="open && activeIndex >= 0 ? `${uid}-option-${activeIndex}` : undefined"
      @click="toggle"
      @keydown="onKeydown"
    >
      <span class="dd-value">{{ currentLabel }}</span>
      <span class="dd-caret" aria-hidden="true">▾</span>
    </button>

    <ul
      v-if="open"
      :id="`${uid}-listbox`"
      ref="menu"
      class="dd-menu"
      role="listbox"
      :style="{ left: pos.left + 'px', top: pos.top + 'px', width: pos.width + 'px' }"
    >
      <li
        v-for="(item, index) in items"
        :id="`${uid}-option-${index}`"
        :key="`${item.value}:${index}`"
        class="dd-option"
        :class="{ 'is-active': index === activeIndex, 'is-selected': isSelected(item) }"
        role="option"
        :aria-selected="isSelected(item) ? 'true' : 'false'"
        @click="select(item)"
        @mouseenter="activeIndex = index"
      >
        {{ item.label }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.dd {
  position: relative;
  width: 100%;
  min-width: 0;
}

.dd-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid var(--border, #e5e5e3);
  border-radius: var(--radius-sm, 4px);
  background: var(--surface, #ffffff);
  color: var(--ink, #2f3437);
  font-family: var(--font-sans, inherit);
  font-size: 14px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
}

.dd-trigger:hover {
  border-color: #d0d0d0;
}

.dd-trigger.is-open,
.dd-trigger:focus-visible {
  outline: 2px solid rgba(47, 52, 55, 0.08);
  border-color: #d0d0d0;
}

.dd-trigger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.dd-value {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.dd-caret {
  flex: none;
  font-size: 10px;
  color: var(--muted, #787774);
}

.dd-menu {
  position: fixed;
  z-index: 300;
  margin: 0;
  padding: 4px;
  max-height: 280px;
  overflow-y: auto;
  list-style: none;
  background: var(--surface, #ffffff);
  border: 1px solid var(--border, #e5e5e3);
  border-radius: var(--radius-sm, 4px);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.14);
}

.dd-option {
  padding: 7px 10px;
  border-radius: var(--radius-sm, 4px);
  font-size: 14px;
  color: var(--ink, #2f3437);
  cursor: pointer;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.dd-option.is-active {
  background: var(--surface-alt, #f7f6f3);
}

.dd-option.is-selected {
  font-weight: 600;
}
</style>
