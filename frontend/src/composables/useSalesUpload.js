import { ref } from 'vue';
import Papa from 'papaparse';
import { apiBase } from '../api/client.js';
import { parseXlsxBuffer } from '../utils/xlsxExport.js';

const REQUIRED_COLUMNS_HINT = 'Nama Sales, Kota, Produk, Penjualan.';

function normalizeUploadRow(row, index) {
  const sp = row['salesperson_name'] || row['Nama Sales'] || row['nama_sales'];
  const city = row['city_name'] || row['Kota'] || row['kota'];
  const prod = row['product_name'] || row['Produk'] || row['produk'];
  const amt = row['amount'] || row['Penjualan'] || row['penjualan'];

  if (!sp || !city || !prod || amt === undefined || amt === '') {
    return { error: `Baris ke-${index + 1} tidak valid. Pastikan ada kolom: ${REQUIRED_COLUMNS_HINT}` };
  }

  const numAmt = Number(amt);
  if (isNaN(numAmt) || numAmt < 0) {
    return { error: `Baris ke-${index + 1} (Sales: ${sp}) memiliki nilai Penjualan yang tidak valid.` };
  }

  return {
    data: {
      salesperson_name: sp.toString().trim(),
      city_name: city.toString().trim(),
      product_name: prod.toString().trim(),
      amount: numAmt,
    },
  };
}

function readUploadFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'csv') {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: (err) => reject(new Error(`Gagal membaca CSV: ${err.message}`)),
      });
    });
  }
  if (ext === 'xlsx' || ext === 'xls') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          resolve(await parseXlsxBuffer(evt.target.result));
        } catch (err) {
          reject(new Error(`Gagal membaca XLSX: ${err.message}`));
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }
  return Promise.reject(new Error('Format file tidak didukung. Gunakan .csv atau .xlsx'));
}

export function useSalesUpload() {
  const fileError = ref('');
  const fileSuccess = ref('');
  const isLoading = ref(false);

  const handleFileUpload = (e) => {
    fileError.value = '';
    fileSuccess.value = '';

    const file = e.target.files[0];
    if (!file) return;

    readUploadFile(file).then(processDataArray, (err) => {
      fileError.value = err.message;
    });
    e.target.value = '';
  };

  const processDataArray = async (dataArray) => {
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      fileError.value = 'Data kosong atau format salah.';
      return;
    }

    const payload = [];
    for (let i = 0; i < dataArray.length; i++) {
      const { data, error } = normalizeUploadRow(dataArray[i], i);
      if (error) {
        fileError.value = error;
        return;
      }
      payload.push(data);
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

  return {
    fileError,
    fileSuccess,
    isLoading,
    handleFileUpload,
  };
}
