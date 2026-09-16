<script setup>
import { ref } from 'vue';
import ManualSaleForm from './ManualSaleForm.vue';
import BulkUpload from './BulkUpload.vue';

const mode = ref('manual');
</script>

<template>
  <div class="data-input-container">
    <header class="input-header">
      <h2>Add New Insight</h2>
      <p>Masukkan data penjualan baru ke dalam sistem untuk diolah di Report Builder.</p>
    </header>

    <div class="mode-tabs">
      <button :class="{ active: mode === 'manual' }" @click="mode = 'manual'">Entry Manual</button>
      <button :class="{ active: mode === 'file' }" @click="mode = 'file'">Upload Batch (.csv / .xlsx)</button>
    </div>

    <transition name="fade" mode="out-in">
      <ManualSaleForm v-if="mode === 'manual'" key="manual" />
      <BulkUpload v-else key="file" />
    </transition>
  </div>
</template>

<style scoped>
.data-input-container {
  max-width: 640px;
  margin: 40px auto;
  position: relative;
  z-index: 2;
  padding: 0 24px;
}

.input-header {
  text-align: center;
  margin-bottom: 32px;
}
.input-header h2 {
  font-size: 2.5rem;
  font-weight: 600;
  letter-spacing: -0.04em;
  color: var(--ink-strong);
  margin-bottom: 8px;
}
.input-header p {
  color: var(--muted);
  font-size: 1.05rem;
}

.mode-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 32px;
  justify-content: center;
  background: rgba(255, 255, 255, 0.4);
  padding: 6px;
  border-radius: 9999px;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  width: max-content;
  margin-left: auto;
  margin-right: auto;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}
.mode-tabs button {
  padding: 8px 24px;
  border: none;
  background: transparent;
  color: var(--muted);
  border-radius: 9999px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.9rem;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.mode-tabs button:hover {
  color: var(--ink-strong);
}
.mode-tabs button.active {
  background: #fff;
  color: var(--ink-strong);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
