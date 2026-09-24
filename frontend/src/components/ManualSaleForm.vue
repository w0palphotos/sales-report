<script setup>
import { ref } from 'vue';
import { apiBase } from '../api/client.js';

const manualForm = ref({
  salesperson_name: '',
  city_name: '',
  product_name: '',
  amount: ''
});

const formError = ref('');
const formSuccess = ref('');
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
</script>

<template>
  <div class="glass-panel">
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
          <label>Penjualan</label>
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
</style>
