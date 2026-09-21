import { normalizeHex } from './cellStyle.js';

// Warna default tabel: dipakai sebagai baseline bila tidak ada aturan warna.
// Ganti nilai di sini untuk mengubah tampilan dasar seluruh tabel.
export const DEFAULT_TABLE_STYLE = {
  header: '#f7f6f3',
  body: '#ffffff',
  color: '#2f3437',
};

// Palet isian cepat bergaya tema Excel.
export const FILL_PALETTE = [
  { label: 'Kuning', bg: '#fff3bf', color: '#7a5c00' },
  { label: 'Oranye', bg: '#ffe8cc', color: '#8a4b08' },
  { label: 'Merah', bg: '#ffd8d8', color: '#9f2f2d' },
  { label: 'Pink', bg: '#fcd9e6', color: '#9d174d' },
  { label: 'Ungu', bg: '#e5dcff', color: '#5b21b6' },
  { label: 'Biru', bg: '#dbeafe', color: '#1e40af' },
  { label: 'Sian', bg: '#d5f4f0', color: '#0f766e' },
  { label: 'Hijau', bg: '#d9f2d9', color: '#166534' },
  { label: 'Abu', bg: '#e6e8eb', color: '#334155' },
];

// Preset tabel: header dan badan diberi tint berbeda agar tidak rata.
export const TABLE_PRESETS = [
  {
    key: 'none',
    label: 'Tanpa preset',
    header: null,
    body: null,
    color: null,
  },
  { key: 'biru', label: 'Biru', header: '#bfdbfe', body: '#eff6ff', color: '#1e3a8a' },
  { key: 'hijau', label: 'Hijau', header: '#bbf7d0', body: '#f0fdf4', color: '#166534' },
  { key: 'ungu', label: 'Ungu', header: '#ddd6fe', body: '#f5f3ff', color: '#5b21b6' },
  { key: 'oranye', label: 'Oranye', header: '#fed7aa', body: '#fff7ed', color: '#9a3412' },
  { key: 'merah', label: 'Merah', header: '#fecaca', body: '#fef2f2', color: '#991b1b' },
  { key: 'abu', label: 'Abu', header: '#cbd5e1', body: '#f8fafc', color: '#1e293b' },
];

// Tema aktif: preset bawaan (kunci) atau preset kustom (objek warna).
// Dipakai saat render sehingga preset otomatis mengikuti baris/kolom baru.
export function resolveTheme(preset) {
  const source =
    preset && typeof preset === 'object'
      ? preset
      : TABLE_PRESETS.find((item) => item.key === preset) ?? null;
  return {
    header: normalizeHex(source?.header) ?? DEFAULT_TABLE_STYLE.header,
    body: normalizeHex(source?.body) ?? DEFAULT_TABLE_STYLE.body,
    color: normalizeHex(source?.color) ?? DEFAULT_TABLE_STYLE.color,
  };
}

// Validasi preset dari UI/laporan tersimpan. Mengembalikan kunci bawaan, objek
// kustom yang sudah dinormalisasi, atau null (tanpa preset).
export function normalizePreset(preset) {
  if (!preset || preset === 'none') return null;
  if (typeof preset === 'object') {
    const header = normalizeHex(preset.header);
    const body = normalizeHex(preset.body);
    if (!header && !body) return null;
    return {
      header: header ?? body,
      body: body ?? header,
      color: normalizeHex(preset.color) ?? DEFAULT_TABLE_STYLE.color,
    };
  }
  return TABLE_PRESETS.some((item) => item.key === preset) ? preset : null;
}

// Kunci kolom posisional yang dicakup preset: kolom nilai, kolom dimensi baris,
// dan (bila ada) grup kolom pivot.
export function presetOwnedKeys(meta, columnKeys = []) {
  const keys = [];
  for (const value of meta?.valueColumns ?? []) {
    keys.push(`val:${value.field ?? value.key}:${value.aggregation}`);
  }
  for (const rowField of meta?.rowFields ?? []) {
    keys.push(`rowdim:${rowField.key}`);
  }
  if (meta?.columnField) {
    for (const columnKey of columnKeys) {
      keys.push(`col:${meta.columnField.key}:${columnKey}`);
    }
  }
  return keys;
}
