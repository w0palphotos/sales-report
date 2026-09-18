// Builder fluent untuk gaya sel tabel: font('Jakarta').bold().bg('#dbeafe').build().
// Tiap method (kecuali build) me-return this agar bisa dirantai.

export const DEFAULT_TEXT = '#2f3437';

export class CellFont {
  constructor(text) {
    this.text = text;
    this.style = {};
  }

  bold() {
    this.style.fontWeight = '700';
    return this;
  }

  italic() {
    this.style.fontStyle = 'italic';
    return this;
  }

  color(value) {
    if (value) this.style.color = value;
    return this;
  }

  bg(value) {
    if (value) this.style.background = value;
    return this;
  }

  align(value) {
    if (value) this.style.textAlign = value;
    return this;
  }

  build() {
    return { text: this.text, style: { ...this.style } };
  }
}

export const font = (text) => new CellFont(text);

// Aturan warna berbentuk { [field]: { [value]: { bg, color } } }.
// Prioritas: override per laporan -> global DB -> tanpa warna (null).
export function resolveColor(field, value, { global = {}, override = {} } = {}) {
  if (field == null || value == null) return null;
  const key = String(value);
  return override?.[field]?.[key] ?? global?.[field]?.[key] ?? null;
}

// Kebalikan toColorMap di composable: peta -> array untuk PUT /colors.
export function colorMapToArray(map) {
  const out = [];
  for (const [field, vals] of Object.entries(map ?? {})) {
    for (const [value, rule] of Object.entries(vals ?? {})) {
      if (rule?.bg) out.push({ field, value, bg: rule.bg, color: rule.color ?? DEFAULT_TEXT });
    }
  }
  return out;
}

// Signature stabil satu baris data (tahan terhadap sort; yatim bila konfigurasi berubah).
export function rowSignature(rowKey, rowFields) {
  return (rowFields ?? [])
    .map((rf) => {
      const key = typeof rf === 'string' ? rf : rf.key;
      return `${key}=${rowKey?.[key] ?? ''}`;
    })
    .join('|');
}

export function styleKey(kind, key) {
  return `${kind}:${key}`;
}

// Aturan posisional { "<kind>:<key>": { kind, key, bg, color } }; override menang.
export function resolveTableStyle(kind, key, { global = {}, override = {} } = {}) {
  if (key == null) return null;
  const k = styleKey(kind, key);
  return override?.[k] ?? global?.[k] ?? null;
}

export function tableStylesToArray(map) {
  return Object.values(map ?? {}).filter(
    (rule) => rule && (rule.kind === 'row' || rule.kind === 'column') && rule.key != null && rule.bg,
  );
}

export function tableStylesToMap(list) {
  const map = {};
  for (const item of list ?? []) {
    if (!item || (item.kind !== 'row' && item.kind !== 'column') || item.key == null) continue;
    map[styleKey(item.kind, item.key)] = {
      kind: item.kind,
      key: item.key,
      bg: item.bg,
      color: item.color ?? DEFAULT_TEXT,
    };
  }
  return map;
}

// Terapkan hasil build() ke sel Handsontable.
export function applyBuiltStyle(td, built) {
  td.innerText = built.text;
  paintCell(td, built.style);
}

// Sheet kita readOnly sehingga semua sel membawa kelas `htDimmed`, yang
// divonis background/color !important oleh CSS bawaan Handsontable.
// Satu-satunya cara menang: setProperty dengan prioritas important;
// reset via removeProperty agar kembali ke tema.
export function paintCell(td, { background = null, color = null } = {}) {
  if (background) td.style.setProperty('background-color', background, 'important');
  else td.style.removeProperty('background-color');
  if (color) td.style.setProperty('color', color, 'important');
  else td.style.removeProperty('color');
}
