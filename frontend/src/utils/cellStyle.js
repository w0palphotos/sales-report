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

// Terapkan hasil build() ke sel Handsontable.
export function applyBuiltStyle(td, built) {
  td.innerText = built.text;
  Object.assign(td.style, built.style);
}
