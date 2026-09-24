<script setup>
import { computed, nextTick, onMounted, ref, toRef, watch } from 'vue';
import { HotTable } from '@handsontable/vue3';
import { registerAllModules } from 'handsontable/registry';
import Handsontable from 'handsontable';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-main.min.css';
import { formatRupiah } from '../utils/format.js';
import { isCountAggregation } from '../utils/aggregation.js';
import {
  font,
  resolveColor,
  applyBuiltStyle,
  paintCell,
  rowSignature,
  resolveTableStyle,
  cellStyleKey,
  styleKey,
  TOTAL_KEY,
  DEFAULT_TEXT,
} from '../utils/cellStyle.js';
import { resolveTheme } from '../utils/tablePresets.js';
import { usePivotGrid } from '../composables/usePivotGrid.js';

registerAllModules();

const props = defineProps({
  result: { type: Object, required: true },
  colors: { type: Object, default: () => ({ global: {}, override: {} }) },
  tableStyles: { type: Object, default: () => ({ global: {}, override: {} }) },
  preset: { type: String, default: null },
  preview: { type: Object, default: null },
});

const emit = defineEmits(['filter-change', 'edit-color', 'edit-preset', 'reset-color']);

const hotRef = ref(null);

const resultRef = toRef(props, 'result');
const { rowDimCount, nestedHeaders, tableData, getVisibleResult } = usePivotGrid(resultRef);

// Tema aktif dari preset. Dihitung ulang setiap render, jadi kolom/baris baru
// otomatis mengikuti preset yang dipilih.
const theme = computed(() => resolveTheme(props.preset));

// Lapisan preview dari popover "Atur warna": warna terlihat langsung di tabel
// sebelum disimpan, tanpa mengubah state tersimpan.
const colorsCtx = computed(() => {
  const preview = props.preview;
  const colors = props.colors ?? {};
  if (!preview || preview.kind !== 'category' || !preview.field || preview.value == null) {
    return colors;
  }
  const override = { ...(colors.override ?? {}) };
  override[preview.field] = {
    ...(override[preview.field] ?? {}),
    [String(preview.value)]: { bg: preview.bg, color: preview.color },
  };
  return { ...colors, override };
});

const stylesCtx = computed(() => {
  const preview = props.preview;
  const styles = props.tableStyles ?? {};
  if (!preview || preview.kind === 'category' || !preview.key) return styles;
  const rule = { kind: preview.kind, key: preview.key, bg: preview.bg, color: preview.color };
  return {
    ...styles,
    override: { ...(styles.override ?? {}), [styleKey(preview.kind, preview.key)]: rule },
  };
});

function cellRenderer(instance, td, row, col, prop, value, cellProperties) {
  Handsontable.renderers.TextRenderer.apply(this, arguments);
  const totalRowIndex = instance.countRows() - 1;
  const isTotalRow = rowDimCount.value > 0 && row === totalRowIndex;
  const isValueCol = col >= rowDimCount.value;
  const physicalRow = typeof instance.toPhysicalRow === 'function' ? instance.toPhysicalRow(row) : row;
  const dataRow = physicalRow >= 0 ? props.result?.rows?.[physicalRow] : null;
  // Baris Grand Total memakai kunci sintetis agar bisa diwarnai seperti baris lain.
  const rowSig = isTotalRow || !dataRow
    ? TOTAL_KEY
    : rowSignature(dataRow.key, props.result?.meta?.rowFields ?? []);

  const numValue = Number(value);
  const isValidNumber = value !== null && value !== '' && !isNaN(numValue);

  if (isValueCol && isValidNumber) {
    const vals = props.result?.meta?.valueColumns ?? [];
    const valIdx = vals.length ? (col - rowDimCount.value) % vals.length : 0;
    const isCount = isCountAggregation(vals[valIdx]?.aggregation);

    td.innerText = isCount ? numValue.toLocaleString('id-ID') : formatRupiah(numValue);
    td.style.textAlign = 'right';
    td.style.fontVariantNumeric = 'tabular-nums';
    const style = valueCellStyle(col, physicalRow, rowSig);
    paintCell(td, { background: style?.bg ?? null, color: style?.color ?? null });
  } else if (!isValueCol) {
    const rFields = props.result?.meta?.rowFields ?? [];
    const fieldKey = rFields[col]?.key;
    const rule = fieldKey ? resolveColor(fieldKey, value, colorsCtx.value) : null;
    if (rule) {
      applyBuiltStyle(td, font(value).bg(rule.bg).color(rule.color ?? DEFAULT_TEXT).build());
    } else {
      const style = labelCellStyle(fieldKey, physicalRow, rowSig);
      paintCell(td, { background: style?.bg ?? null, color: style?.color ?? null });
    }
    if (rFields[col]?.key === 'amount' && isValidNumber && !isTotalRow) {
      td.innerText = formatRupiah(numValue);
      td.style.textAlign = 'right';
    } else {
      td.style.textAlign = 'left';
    }
    td.style.fontWeight = '500';
  }

  if (isTotalRow) {
    td.style.fontWeight = '700';
    td.style.borderTop = '2px solid var(--border, #e5e5e3)';
  }
}

// Tint baris: warna persis aturan pertama yang cocok di antara field baris.
function rowTintFor(physicalRow) {
  const dataRow = physicalRow >= 0 ? props.result?.rows?.[physicalRow] : null;
  if (!dataRow) return null;
  for (const rf of props.result?.meta?.rowFields ?? []) {
    const rule = resolveColor(rf.key, dataRow.key?.[rf.key], colorsCtx.value);
    if (rule?.bg) return rule.bg;
  }
  return null;
}

// Tint kolom: aturan untuk kunci kolom pivot di bawah dimensi kolom (Grand Total tidak).
function columnTintFor(col) {
  const meta = props.result?.meta;
  const valCount = meta?.valueColumns?.length ?? 0;
  if (!meta?.columnField || valCount === 0) return null;
  const offset = col - rowDimCount.value;
  if (offset < 0) return null;
  const ck = (props.result?.columnKeys ?? [])[Math.floor(offset / valCount)];
  if (ck == null) return null;
  const rule = resolveColor(meta.columnField.key, ck, colorsCtx.value);
  return rule?.bg ?? null;
}

// Aturan posisional baris untuk baris data (null untuk total/footer).
function rowStyleFor(physicalRow) {
  const dataRow = physicalRow >= 0 ? props.result?.rows?.[physicalRow] : null;
  if (!dataRow) return null;
  return resolveTableStyle(
    'row',
    rowSignature(dataRow.key, props.result?.meta?.rowFields ?? []),
    stylesCtx.value,
  );
}

// Kunci kolom posisional untuk sel nilai: grup (bila di bawah grup kolom) + measure.
// `columnId` mengidentifikasi kolom ini secara unik untuk pewarnaan sel.
function valueCellColumnKeys(col) {
  const meta = props.result?.meta ?? {};
  const vCols = meta.valueColumns ?? [];
  if (vCols.length === 0) return null;
  const valCount = Math.max(1, vCols.length);
  const offset = col - rowDimCount.value;
  if (offset < 0) return null;
  const groupIdx = Math.floor(offset / valCount);
  const vc = vCols[offset % valCount];
  if (!vc) return null;
  const valKey = `val:${vc.field ?? vc.key}:${vc.aggregation}`;
  if (meta.columnField) {
    const columnKeys = props.result?.columnKeys ?? [];
    const isGrand = groupIdx >= columnKeys.length;
    const ck = isGrand ? TOTAL_KEY : columnKeys[groupIdx];
    const groupKey = `col:${meta.columnField.key}:${ck}`;
    return {
      groupKey,
      groupLabel: isGrand ? 'Grand Total' : String(ck),
      valKey,
      valLabel: vc.label,
      columnId: `${groupKey}|${valKey}`,
    };
  }
  return { groupKey: null, groupLabel: null, valKey, valLabel: vc.label, columnId: valKey };
}

// Preseden sel nilai: sel > baris > kolom (grup lalu measure) > tint kategori lama.
// `rowSig` = signature baris, atau TOTAL_KEY untuk baris Grand Total.
function valueCellStyle(col, physicalRow, rowSig) {
  const styles = stylesCtx.value;
  const isTotal = rowSig === TOTAL_KEY;
  const keys = valueCellColumnKeys(col);
  if (rowSig) {
    if (keys) {
      const cell = resolveTableStyle('cell', cellStyleKey(rowSig, keys.columnId), styles);
      if (cell?.bg) return cell;
    }
    const rs = resolveTableStyle('row', rowSig, styles);
    if (rs?.bg) return rs;
  }
  if (keys) {
    if (keys.groupKey) {
      const gs = resolveTableStyle('column', keys.groupKey, styles);
      if (gs?.bg) return gs;
    }
    const vs = resolveTableStyle('column', keys.valKey, styles);
    if (vs?.bg) return vs;
  }
  if (!isTotal) {
    const legacy = columnTintFor(col) ?? (physicalRow >= 0 ? rowTintFor(physicalRow) : null);
    if (legacy) return { bg: legacy, color: null };
  }
  return isTotal
    ? { bg: theme.value.header, color: theme.value.color }
    : { bg: theme.value.body, color: theme.value.color };
}

// Preseden sel label baris: sel > kategori penuh > baris > kolom dimensi > tint lama.
// `rowSig` = signature baris, atau TOTAL_KEY untuk baris Grand Total.
function labelCellStyle(fieldKey, physicalRow, rowSig) {
  const styles = stylesCtx.value;
  const isTotal = rowSig === TOTAL_KEY;
  if (rowSig && fieldKey) {
    const cell = resolveTableStyle('cell', cellStyleKey(rowSig, `rowdim:${fieldKey}`), styles);
    if (cell?.bg) return cell;
  }
  if (rowSig) {
    const rs = resolveTableStyle('row', rowSig, styles);
    if (rs?.bg) return rs;
  }
  if (fieldKey) {
    const ds = resolveTableStyle('column', `rowdim:${fieldKey}`, styles);
    if (ds?.bg) return ds;
  }
  if (!isTotal) {
    const legacy = physicalRow >= 0 ? rowTintFor(physicalRow) : null;
    if (legacy) return { bg: legacy, color: null };
  }
  return isTotal
    ? { bg: theme.value.header, color: theme.value.color }
    : { bg: theme.value.body, color: theme.value.color };
}

// Gaya header: aturan header khusus > aturan kolom > tint kategori lama (grup teratas saja).
function resolveColumnFill(key, styles) {
  return resolveTableStyle('header', key, styles) ?? resolveTableStyle('column', key, styles);
}

function headerStyleFor(col, headerRow) {
  const meta = props.result?.meta ?? {};
  const rFields = meta.rowFields ?? [];
  const vCols = meta.valueColumns ?? [];
  const valCount = Math.max(1, vCols.length);
  const styles = stylesCtx.value;

  if (!meta.columnField) {
    if (headerRow !== 0) return null;
    if (col < rFields.length) {
      const rf = rFields[col];
      return rf ? resolveColumnFill(`rowdim:${rf.key}`, styles) : null;
    }
    const vc = vCols[col - rFields.length];
    return vc ? resolveColumnFill(`val:${vc.field ?? vc.key}:${vc.aggregation}`, styles) : null;
  }

  if (headerRow === 0) {
    const offset = col - rowDimCount.value;
    if (offset < 0) {
      const rf = rFields[col];
      return rf ? resolveColumnFill(`rowdim:${rf.key}`, styles) : null;
    }
    const groupIdx = Math.floor(offset / valCount);
    const cks = props.result?.columnKeys ?? [];
    const ck = groupIdx >= cks.length ? TOTAL_KEY : cks[groupIdx]; // Grand Total
    return resolveColumnFill(`col:${meta.columnField.key}:${ck}`, styles);
  }

  const offset = col - rowDimCount.value;
  if (offset < 0) return null;
  const vc = vCols[offset % valCount];
  return vc ? resolveColumnFill(`val:${vc.field ?? vc.key}:${vc.aggregation}`, styles) : null;
}

// Tint header kolom dimensi; Grand Total dan sub-header ikut tema preset.
function tintColHeader(col, TH, headerRow) {
  if (!TH) return;
  const positional = headerStyleFor(col, headerRow);
  if (positional?.bg) {
    paintCell(TH, { background: positional.bg });
    return;
  }
  if (headerRow !== 0) {
    paintCell(TH, { background: theme.value.header });
    return;
  }
  const meta = props.result?.meta;
  const valCount = meta?.valueColumns?.length ?? 0;
  const offset = col - rowDimCount.value;
  if (!meta?.columnField || valCount === 0 || offset < 0) {
    paintCell(TH, { background: theme.value.header });
    return;
  }
  const ck = (props.result?.columnKeys ?? [])[Math.floor(offset / valCount)];
  const rule = ck == null ? null : resolveColor(meta.columnField.key, ck, colorsCtx.value);
  paintCell(TH, { background: rule?.bg ?? theme.value.header });
}

// Nomor baris mengikuti aturan baris bila ada, jika tidak ikut tema preset.
function tintRowHeader(row, TH) {
  if (!TH) return;
  const instance = hotRef.value?.hotInstance;
  const physicalRow = instance ? instance.toPhysicalRow(row) : row;
  const dataRow = physicalRow >= 0 ? props.result?.rows?.[physicalRow] : null;
  const totalRowIndex = instance ? instance.countRows() - 1 : -1;
  const isTotal = rowDimCount.value > 0 && row === totalRowIndex;
  const rowSig = isTotal || !dataRow
    ? TOTAL_KEY
    : rowSignature(dataRow.key, props.result?.meta?.rowFields ?? []);
  const rs = resolveTableStyle('row', rowSig, stylesCtx.value);
  paintCell(TH, { background: rs?.bg ?? theme.value.header });
}

// Kandidat target dari sel yang sedang terseleksi: sel, kategori (bila sel label),
// baris (selalu), kolom (sel nilai). Baris Grand Total ikut didukung.
function selectionOptions() {
  const instance = hotRef.value?.hotInstance;
  const sel = instance?.getSelectedLast?.();
  if (!sel) return [];
  const out = [];
  const vRow = sel[0];
  const vCol = sel[1];
  const physicalRow = vRow != null && vRow >= 0 ? instance.toPhysicalRow(vRow) : -1;
  const physicalCol = vCol != null && vCol >= 0 ? instance.toPhysicalColumn(vCol) : -1;
  const totalRowIndex = instance.countRows() - 1;
  const isTotalRow = rowDimCount.value > 0 && vRow === totalRowIndex;
  const dataRow = physicalRow >= 0 ? props.result?.rows?.[physicalRow] : null;
  if (!dataRow && !isTotalRow) return out;
  const rFields = props.result?.meta?.rowFields ?? [];
  const rowSig = isTotalRow ? TOTAL_KEY : rowSignature(dataRow.key, rFields);
  const rowLabel = isTotalRow ? 'Baris Grand Total' : 'Baris ini';

  const columnId =
    physicalCol >= 0 && physicalCol < rowDimCount.value
      ? `rowdim:${rFields[physicalCol]?.key}`
      : valueCellColumnKeys(vCol)?.columnId ?? null;

  if (columnId) {
    out.push({ kind: 'cell', key: cellStyleKey(rowSig, columnId), label: 'Sel ini' });
  }

  if (physicalCol >= 0 && physicalCol < rowDimCount.value) {
    const rf = rFields[physicalCol];
    const value = dataRow?.key?.[rf?.key];
    if (!isTotalRow && rf && value != null && value !== '') {
      out.push({
        kind: 'category',
        field: rf.key,
        value: String(value),
        label: `${rf.label} = ${value}`,
      });
      out.push({ kind: 'column', key: `rowdim:${rf.key}`, label: `Kolom ${rf.label}` });
    }
  } else if (physicalCol >= rowDimCount.value) {
    const keys = valueCellColumnKeys(vCol);
    if (keys?.valKey) out.push({ kind: 'column', key: keys.valKey, label: `Kolom ${keys.valLabel}` });
    if (keys?.groupKey) out.push({ kind: 'column', key: keys.groupKey, label: `Kolom ${keys.groupLabel}` });
  }

  out.push({ kind: 'row', key: rowSig, label: rowLabel });
  return out;
}

// Kandidat dari TH header (klik kanan): grup kolom / label dimensi / sub-header measure.
function headerOptionsFromEl(el, coords) {
  const th = el?.closest?.('th');
  const tr = th?.closest?.('tr');
  const thead = th?.closest?.('thead');
  if (!th || !tr || !thead) return [];
  // Klik header kolom: baris negatif dan kolom valid. Pakai coords.col, bukan
  // th.cellIndex, karena cellIndex ikut menghitung sel pojok (row header).
  if (!coords || coords.col == null || coords.col < 0 || coords.row >= 0) return [];
  const rows = Array.from(thead.rows);
  const ri = rows.indexOf(tr);
  const meta = props.result?.meta ?? {};
  const rFields = meta.rowFields ?? [];
  const vCols = meta.valueColumns ?? [];
  const valCount = Math.max(1, vCols.length);
  const ci = coords.col;

  if (ri === 0 && !meta.columnField) {
    if (ci < rFields.length) {
      const rf = rFields[ci];
      return rf ? [{ kind: 'column', key: `rowdim:${rf.key}`, label: `Kolom ${rf.label}` }] : [];
    }
    const vc = vCols[ci - rFields.length];
    return vc ? [{ kind: 'column', key: `val:${vc.field ?? vc.key}:${vc.aggregation}`, label: `Kolom ${vc.label}` }] : [];
  }
  if (ri !== 0) {
    if (!meta.columnField) return [];
    const vc = vCols[ci % valCount];
    return vc ? [{ kind: 'column', key: `val:${vc.field ?? vc.key}:${vc.aggregation}`, label: `Kolom ${vc.label}` }] : [];
  }
  const label = (th.textContent ?? '').trim();
  if (meta.columnField && label === 'Grand Total') {
    return [{ kind: 'column', key: `col:${meta.columnField.key}:${TOTAL_KEY}`, label: 'Kolom Grand Total' }];
  }
  const ck = (props.result?.columnKeys ?? []).find((k) => String(k) === label);
  if (ck != null && meta.columnField) {
    return [{ kind: 'column', key: `col:${meta.columnField.key}:${ck}`, label: `Kolom ${ck}` }];
  }
  const rf = rFields.find((r) => r.label === label);
  if (rf) return [{ kind: 'column', key: `rowdim:${rf.key}`, label: `Kolom ${rf.label}` }];
  return [];
}

let pendingHeaderOptions = [];

function attachRules(opt) {
  if (opt.kind === 'category') {
    return {
      ...opt,
      globalRule: props.colors?.global?.[opt.field]?.[opt.value] ?? null,
      overrideRule: props.colors?.override?.[opt.field]?.[opt.value] ?? null,
    };
  }
  const styles = stylesCtx.value;
  return {
    ...opt,
    globalRule: resolveTableStyle(opt.kind, opt.key, { global: styles.global }) ?? null,
    overrideRule: resolveTableStyle(opt.kind, opt.key, { override: styles.override }) ?? null,
  };
}

function dedupeOptions(options) {
  const seen = new Set();
  return options.filter((opt) => {
    const key = `${opt.kind}:${opt.kind === 'category' ? `${opt.field}=${opt.value}` : opt.key}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function onSetColor(_key, _selection, clickEvent) {
  const merged = dedupeOptions([...pendingHeaderOptions, ...selectionOptions()]);
  pendingHeaderOptions = [];
  if (merged.length === 0) return;
  emit('edit-color', {
    options: merged.map(attachRules),
    x: clickEvent?.clientX ?? 0,
    y: clickEvent?.clientY ?? 0,
  });
}

// Item "Preset warna tabel" membuka popover pemilih preset.
function onEditPreset(_key, _selection, clickEvent) {
  emit('edit-preset', { x: clickEvent?.clientX ?? 0, y: clickEvent?.clientY ?? 0 });
}

function onCellMouseDown(event, coords) {
  pendingHeaderOptions = [];
  if (event?.button === 2) {
    pendingHeaderOptions = headerOptionsFromEl(event.target, coords);
  }
}

function onMenuHide() {
  pendingHeaderOptions = [];
}

function hideSetColorItem() {
  if (pendingHeaderOptions.length > 0) return false;
  return selectionOptions().length === 0;
}

// Item reset hanya tampil bila masih ada warna (preset, override laporan, atau global).
function hideResetColorItem() {
  const colors = props.colors || {};
  const styles = props.tableStyles || {};
  return !(
    Boolean(props.preset) ||
    hasEntries(colors.override) ||
    hasEntries(colors.global) ||
    hasEntries(styles.override) ||
    hasEntries(styles.global)
  );
}

function hasEntries(value) {
  return Boolean(value) && Object.keys(value).length > 0;
}

function onResetColor() {
  emit('reset-color');
}

function notifyFilterChange() {
  nextTick(() => {
    const instance = hotRef.value?.hotInstance;
    if (instance) {
      const filtered = getVisibleResult(instance);
      emit('filter-change', filtered);
    }
  });
}

const hotSettings = computed(() => ({
  data: tableData.value,
  nestedHeaders: nestedHeaders.value,
  readOnly: true,
  // ponytail: read-only mode for report viewer; upgrade to editable if live calculation needed
  licenseKey: 'non-commercial-and-evaluation',
  renderer: cellRenderer,
  columnSorting: true,
  dropdownMenu: false,
  filters: false,
  hiddenColumns: { indicators: true },
  hiddenRows: { indicators: true },
  contextMenu: {
    items: {
      hidden_columns_show: {},
      hidden_columns_hide: {},
      set_category_color: {
        name: 'Atur warna',
        hidden: hideSetColorItem,
        callback: onSetColor,
      },
      set_table_preset: {
        name: 'Preset warna tabel',
        callback: onEditPreset,
      },
      reset_table_color: {
        name: 'Reset warna tabel',
        hidden: hideResetColorItem,
        callback: onResetColor,
      },
    },
  },
  stretchH: 'all',
  autoWrapRow: true,
  autoWrapCol: true,
  height: 'auto',
  rowHeaders: true,
  manualColumnResize: true,
  themeName: 'ht-theme-main',
  afterFilter() {
    notifyFilterChange();
  },
  afterColumnSort() {
    notifyFilterChange();
  },
  afterGetColHeader(col, TH, headerRow) {
    tintColHeader(col, TH, headerRow);
  },
  afterGetRowHeader(row, TH) {
    tintRowHeader(row, TH);
  },
  afterOnCellMouseDown(event, coords) {
    onCellMouseDown(event, coords);
  },
  afterContextMenuHide() {
    onMenuHide();
  },
}));

watch(
  () => props.result,
  (newVal) => {
    if (newVal) {
      emit('filter-change', newVal);
    }
  },
  { immediate: true },
);

// Tabel tidak me-render ulang sendiri saat aturan warna/preview berubah
// (mis. loadColors yang async), jadi picu render manual.
watch(
  [() => props.colors, () => props.tableStyles, () => props.preview],
  () => {
    const instance = hotRef.value?.hotInstance;
    if (instance) instance.render();
  },
  { deep: true },
);

// Wrapper Handsontable hanya menyinkronkan `data` lewat referensi (array baru
// dari hasil pivot diabaikan), jadi datanya harus dimuat ulang secara eksplisit
// agar tabel tidak menampilkan angka dari laporan sebelumnya.
watch(tableData, (data) => {
  const instance = hotRef.value?.hotInstance;
  if (instance) instance.loadData(data);
});

onMounted(() => {
  if (props.result) {
    emit('filter-change', props.result);
  }
});

defineExpose({
  hotRef,
  tableData,
});
</script>

<template>
  <div class="hot-container">
    <HotTable :key="JSON.stringify(nestedHeaders) + '-' + tableData.length" ref="hotRef" :settings="hotSettings" />
  </div>
</template>

<style scoped>
.hot-container {
  width: 100%;
  overflow-x: auto;
}

:deep(.handsontable) {
  font-family: var(--font-sans, inherit);
  font-size: 13px;
  color: var(--ink, #2f3437);
}

:deep(.handsontable th) {
  font-weight: 600;
  background: var(--surface-alt, #f7f6f3);
  color: var(--ink-strong, #111111);
}

:deep(.handsontable td) {
  padding: 6px 10px;
}
</style>
