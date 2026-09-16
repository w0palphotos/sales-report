import { ref } from 'vue';
import Papa from 'papaparse';
import { apiBase } from '../api/client.js';
import { parseXlsxBuffer } from '../utils/xlsxExport.js';

export function useSalesUpload() {
  const fileError = ref('');
  const fileSuccess = ref('');
  const isLoading = ref(false);

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
      reader.onload = async (evt) => {
        try {
          const json = await parseXlsxBuffer(evt.target.result);
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

  return {
    fileError,
    fileSuccess,
    isLoading,
    handleFileUpload,
  };
}
