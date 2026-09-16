<script setup>
defineProps({
  modelValue: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue', 'save', 'cancel']);
</script>

<template>
  <div class="sheet-drawer">
    <div class="save-row">
      <input
        :value="modelValue"
        type="text"
        placeholder="Nama konfigurasi laporan ini…"
        @input="emit('update:modelValue', $event.target.value)"
        @keyup.enter="emit('save')"
      />
      <button
        type="button"
        class="btn btn-primary btn-small"
        :disabled="!modelValue.trim()"
        @click="emit('save')"
      >
        Simpan
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-small"
        @click="emit('cancel')"
      >
        Batal
      </button>
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

.save-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.save-row input {
  max-width: 320px;
}
</style>
