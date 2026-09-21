import { styleKey } from './cellStyle.js';

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

export function getTablePreset(key) {
  return TABLE_PRESETS.find((preset) => preset.key === key) ?? TABLE_PRESETS[0];
}

// Kunci kolom posisional yang dimiliki preset: kolom nilai, kolom dimensi baris,
// dan (bila ada) grup kolom pivot.
export function presetColumnKeys(meta, columnKeys = []) {
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

// Entri gaya untuk satu preset, siap dimerge ke override config.styles.
export function presetStyleEntries(presetKey, { meta, columnKeys = [] } = {}) {
  const preset = getTablePreset(presetKey);
  const keys = presetColumnKeys(meta, columnKeys);
  const entries = {};

  for (const key of keys) {
    if (!preset.header) {
      delete entries[styleKey('header', key)];
      delete entries[styleKey('column', key)];
      continue;
    }
    entries[styleKey('header', key)] = { kind: 'header', key, bg: preset.header, color: preset.color };
    entries[styleKey('column', key)] = { kind: 'column', key, bg: preset.body, color: preset.color };
  }

  return { entries, keys };
}
