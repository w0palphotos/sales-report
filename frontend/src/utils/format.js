export function formatRupiah(value) {
  const number = Number(value) || 0;
  const options = Number.isInteger(number)
    ? { maximumFractionDigits: 0 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return `Rp${number.toLocaleString('id-ID', options)}`;
}

export function formatCompact(value) {
  const number = Number(value) || 0;
  if (number >= 1_000_000_000) return `${trim((number / 1_000_000_000).toFixed(1))} M`;
  if (number >= 1_000_000) return `${trim((number / 1_000_000).toFixed(1))} jt`;
  if (number >= 1_000) return `${trim((number / 1_000).toFixed(1))} rb`;
  return String(Math.round(number));
}

function trim(text) {
  return text.replace(/\.0$/, '');
}
