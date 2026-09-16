<script setup>
import { useSalesUpload } from '../composables/useSalesUpload.js';

const { fileError, fileSuccess, isLoading, handleFileUpload } = useSalesUpload();
</script>

<template>
  <div class="glass-panel">
    <div class="panel-header">
      <h3>Bulk Upload</h3>
      <span class="badge">CSV / XLSX</span>
    </div>
    <div class="guide-box">
      <p class="guide-title">Format Kolom yang Diperlukan:</p>
      <div class="guide-tags">
        <span class="tag">Nama Sales</span>
        <span class="tag">Kota</span>
        <span class="tag">Produk</span>
        <span class="tag">Penjualan</span>
      </div>
    </div>

    <div v-if="fileError" class="alert error">{{ fileError }}</div>
    <div v-if="fileSuccess" class="alert success">{{ fileSuccess }}</div>

    <label class="file-dropzone" :class="{ 'is-loading': isLoading }">
      <input type="file" accept=".csv, .xlsx, .xls" @change="handleFileUpload" :disabled="isLoading" />
      <div class="dropzone-content">
        <div class="upload-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        </div>
        <p class="primary-text" v-if="!isLoading">Pilih file atau drop ke sini</p>
        <p class="primary-text loading-text" v-else>Memproses file...</p>
        <p class="secondary-text" v-if="!isLoading">Mendukung .csv, .xlsx</p>
      </div>
    </label>
  </div>
</template>

<style scoped>
.glass-panel {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 20px;
  padding: 32px;
  box-shadow: 0 12px 48px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255, 255, 255, 1);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.panel-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--ink-strong);
  margin: 0;
}
.badge {
  background: var(--ink-strong);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 4px 10px;
  border-radius: 9999px;
  text-transform: uppercase;
}

.guide-box {
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(0, 0, 0, 0.05);
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 24px;
}
.guide-title {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--muted);
  margin-bottom: 12px;
}
.guide-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.guide-tags .tag {
  background: #fff;
  border: 1px solid var(--border-color);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--ink-strong);
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
}

.alert {
  padding: 14px 16px;
  border-radius: 10px;
  margin-bottom: 24px;
  font-size: 0.9rem;
  font-weight: 500;
}
.alert.error {
  background: #fdf2f2;
  color: #c53030;
  border: 1px solid rgba(252, 129, 129, 0.3);
}
.alert.success {
  background: #f0fff4;
  color: #276749;
  border: 1px solid rgba(104, 211, 145, 0.3);
}

.file-dropzone {
  display: block;
  border: 2px dashed rgba(0,0,0,0.1);
  border-radius: 16px;
  padding: 48px 24px;
  text-align: center;
  background: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}
.file-dropzone:hover:not(.is-loading) {
  border-color: var(--ink-strong);
  background: rgba(255, 255, 255, 0.9);
}
.file-dropzone input[type="file"] {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  opacity: 0;
  cursor: pointer;
}
.file-dropzone.is-loading {
  cursor: not-allowed;
  opacity: 0.7;
}

.upload-icon {
  width: 48px;
  height: 48px;
  background: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  color: var(--ink-strong);
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.dropzone-content .primary-text {
  font-size: 1.05rem;
  font-weight: 500;
  color: var(--ink-strong);
  margin-bottom: 4px;
}
.dropzone-content .secondary-text {
  font-size: 0.9rem;
  color: var(--muted);
}
.loading-text {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
