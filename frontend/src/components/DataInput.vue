<script setup>
import { ref } from 'vue';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { apiBase } from '../api/client.js';

const mode = ref('manual');

const manualForm = ref({
  salesperson_name: '',
  city_name: '',
  product_name: '',
  amount: ''
});

const formError = ref('');
const formSuccess = ref('');

const fileError = ref('');
const fileSuccess = ref('');

const isLoading = ref(false);

const submitManual = async () => {
  formError.value = '';
  formSuccess.value = '';
  
  if (!manualForm.value.salesperson_name || !manualForm.value.city_name || !manualForm.value.product_name || manualForm.value.amount === '') {
    formError.value = 'Semua field (Nama Sales, Kota, Produk, Penjualan) harus diisi.';
    return;
  }
  
  const amount = Number(manualForm.value.amount);
  if (isNaN(amount) || amount < 0) {
    formError.value = 'Penjualan harus berupa angka dan tidak boleh negatif.';
    return;
  }
  
  isLoading.value = true;
  try {
    const res = await fetch(`${apiBase}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        salesperson_name: manualForm.value.salesperson_name,
        city_name: manualForm.value.city_name,
        product_name: manualForm.value.product_name,
        amount
      })
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Gagal menyimpan data');
    }
    
    formSuccess.value = 'Data berhasil disimpan.';
    manualForm.value = { salesperson_name: '', city_name: '', product_name: '', amount: '' };
  } catch (e) {
    formError.value = e.message;
  } finally {
    isLoading.value = false;
  }
};

const handleFileUpload = (e) => {
  fileError.value = '';
  fileSuccess.value = '';
  
  const file = e.target.files[0];
  if (!file) return;

  const ext = file.name.split('.').pop().toLowerCase();
  
  if (ext === 'csv') {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => processDataArray(results.data),
      error: (err) => {
        fileError.value = `Gagal membaca CSV: ${err.message}`;
      }
    });
  } else if (ext === 'xlsx' || ext === 'xls') {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
        processDataArray(json);
      } catch (err) {
        fileError.value = `Gagal membaca XLSX: ${err.message}`;
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    fileError.value = 'Format file tidak didukung. Gunakan .csv atau .xlsx';
  }
  e.target.value = '';
};

const processDataArray = async (dataArray) => {
  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    fileError.value = 'Data kosong atau format salah.';
    return;
  }
  
  const payload = [];
  for (let i = 0; i < dataArray.length; i++) {
    const row = dataArray[i];
    
    const sp = row['salesperson_name'] || row['Nama Sales'] || row['nama_sales'];
    const city = row['city_name'] || row['Kota'] || row['kota'];
    const prod = row['product_name'] || row['Produk'] || row['produk'];
    const amt = row['amount'] || row['Penjualan'] || row['penjualan'];
    
    if (!sp || !city || !prod || amt === undefined || amt === '') {
      fileError.value = `Baris ke-${i + 1} tidak valid. Pastikan ada kolom: Nama Sales, Kota, Produk, Penjualan.`;
      return;
    }
    
    const numAmt = Number(amt);
    if (isNaN(numAmt) || numAmt < 0) {
      fileError.value = `Baris ke-${i + 1} (Sales: ${sp}) memiliki nilai Penjualan yang tidak valid.`;
      return;
    }
    
    payload.push({
      salesperson_name: sp.toString().trim(),
      city_name: city.toString().trim(),
      product_name: prod.toString().trim(),
      amount: numAmt
    });
  }
  
  isLoading.value = true;
  try {
    const res = await fetch(`${apiBase}/sales/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Gagal menyimpan bulk data');
    }
    
    const resData = await res.json();
    fileSuccess.value = `${resData.message} (Total ${payload.length} data)`;
  } catch (e) {
    fileError.value = e.message;
  } finally {
    isLoading.value = false;
  }
};
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
      <div v-if="mode === 'manual'" key="manual" class="glass-panel">
        <div class="panel-header">
          <h3>Single Entry</h3>
          <span class="badge">Manual</span>
        </div>
        
        <div v-if="formError" class="alert error">{{ formError }}</div>
        <div v-if="formSuccess" class="alert success">{{ formSuccess }}</div>

        <form @submit.prevent="submitManual" class="modern-form">
          <div class="form-grid">
            <div class="form-group">
              <label>Nama Sales</label>
              <input type="text" v-model="manualForm.salesperson_name" placeholder="Cth: Andi" />
            </div>
            <div class="form-group">
              <label>Kota</label>
              <input type="text" v-model="manualForm.city_name" placeholder="Cth: Jakarta" />
            </div>
            <div class="form-group">
              <label>Produk</label>
              <input type="text" v-model="manualForm.product_name" placeholder="Cth: Honda" />
            </div>
            <div class="form-group">
              <label>Penjualan (Rp)</label>
              <input type="number" v-model="manualForm.amount" min="0" placeholder="Cth: 120000000" />
            </div>
          </div>
          
          <div class="form-actions">
            <button type="submit" :disabled="isLoading" class="btn-primary-glow">
              {{ isLoading ? 'Menyimpan...' : 'Simpan Transaksi' }}
            </button>
          </div>
        </form>
      </div>

      <div v-else key="file" class="glass-panel">
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

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.form-group label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--muted);
}
.form-group input {
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.8);
  font-size: 1rem;
  color: var(--ink-strong);
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
}
.form-group input:focus {
  outline: none;
  border-color: var(--ink-strong);
  background: #fff;
  box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.04);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid rgba(0,0,0,0.05);
  padding-top: 24px;
}

.btn-primary-glow {
  background: var(--ink-strong);
  color: white;
  border: none;
  padding: 12px 28px;
  border-radius: 9999px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
}
.btn-primary-glow:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}
.btn-primary-glow:active:not(:disabled) {
  transform: scale(0.98);
}
.btn-primary-glow:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
