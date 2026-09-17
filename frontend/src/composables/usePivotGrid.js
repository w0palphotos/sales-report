import { computed } from 'vue';

export function usePivotGrid(resultSource) {
  const rowFields = computed(() => resultSource.value?.meta?.rowFields ?? []);
  const columnField = computed(() => resultSource.value?.meta?.columnField ?? null);
  const valueColumns = computed(() => resultSource.value?.meta?.valueColumns ?? []);
  const columnKeys = computed(() => resultSource.value?.columnKeys ?? []);
  const columnTotals = computed(() => resultSource.value?.columnTotals ?? {});
  const grandTotal = computed(() => resultSource.value?.grandTotal ?? []);

  const rowDimCount = computed(() => rowFields.value.length);

  const nestedHeaders = computed(() => {
    if (!resultSource.value) return [];
    const rows = rowFields.value;
    const vals = valueColumns.value;
    const cols = columnKeys.value;

    if (columnField.value) {
      const topRow = [
        ...rows.map((rf) => ({ label: rf.label, rowspan: 2 })),
        ...cols.map((ck) => ({ label: ck, colspan: Math.max(1, vals.length) })),
        { label: 'Grand Total', colspan: Math.max(1, vals.length) },
      ];
      const bottomRow = [
        ...rows.map(() => ''),
        ...cols.flatMap(() => (vals.length ? vals.map((v) => v.label) : [''])),
        ...(vals.length ? vals.map((v) => v.label) : ['']),
      ];
      return [topRow, bottomRow];
    }

    return [
      [
        ...rows.map((rf) => rf.label),
        ...vals.map((v) => v.label),
      ],
    ];
  });

  const tableData = computed(() => {
    if (!resultSource.value) return [];
    const data = [];
    const rFields = rowFields.value;
    const cKeys = columnKeys.value;
    const vals = valueColumns.value;
    const hasCol = Boolean(columnField.value);

    // Data rows
    for (const row of resultSource.value.rows ?? []) {
      const rowArr = [];
      for (const rf of rFields) {
        rowArr.push(row.key[rf.key] ?? '');
      }
      if (hasCol) {
        for (const ck of cKeys) {
          const cellVals = row.cells[ck] ?? [];
          if (vals.length === 0) {
            rowArr.push('');
          } else {
            for (const val of cellVals) {
              rowArr.push(val);
            }
          }
        }
        if (vals.length === 0) {
          rowArr.push('');
        } else {
          for (const val of row.rowTotal ?? []) {
            rowArr.push(val);
          }
        }
      } else {
        for (const val of row.cells['__all__'] ?? []) {
          rowArr.push(val);
        }
      }
      data.push(rowArr);
    }

    // Total footer row (only shown if there is at least one row dimension)
    if (rFields.length > 0) {
      const totalRow = [];
      rFields.forEach((_, i) => {
        totalRow.push(i === 0 ? 'Grand Total' : '');
      });
      if (hasCol) {
        for (const ck of cKeys) {
          const colTot = columnTotals.value[ck] ?? [];
          if (vals.length === 0) {
            totalRow.push('');
          } else {
            for (const val of colTot) {
              totalRow.push(val);
            }
          }
        }
        if (vals.length === 0) {
          totalRow.push('');
        } else {
          for (const val of grandTotal.value) {
            totalRow.push(val);
          }
        }
      } else {
        for (const val of grandTotal.value) {
          totalRow.push(val);
        }
      }
      data.push(totalRow);
    }

    return data;
  });

  function getVisibleResult(instance) {
    if (!instance || !resultSource.value) return resultSource.value;
    const count = instance.countRows();
    const visibleRows = [];
    const rawRows = resultSource.value.rows ?? [];
    const totalRowPhysicalIndex = rawRows.length;

    for (let visualRow = 0; visualRow < count; visualRow++) {
      const physicalRow = instance.toPhysicalRow(visualRow);
      if (physicalRow >= 0 && physicalRow < totalRowPhysicalIndex && rawRows[physicalRow]) {
        visibleRows.push(rawRows[physicalRow]);
      }
    }

    const hasCol = Boolean(columnField.value);
    const valCount = valueColumns.value.length;
    const cKeys = columnKeys.value;

    const recalculatedColumnTotals = {};
    for (const ck of cKeys) {
      recalculatedColumnTotals[ck] = Array(valCount).fill(0);
    }
    const recalculatedGrandTotal = Array(valCount).fill(0);

    for (const row of visibleRows) {
      if (hasCol) {
        for (const ck of cKeys) {
          const cells = row.cells[ck] ?? [];
          for (let v = 0; v < valCount; v++) {
            recalculatedColumnTotals[ck][v] += Number(cells[v]) || 0;
          }
        }
        for (let v = 0; v < valCount; v++) {
          recalculatedGrandTotal[v] += Number(row.rowTotal?.[v]) || 0;
        }
      } else {
        const cells = row.cells['__all__'] ?? [];
        for (let v = 0; v < valCount; v++) {
          recalculatedGrandTotal[v] += Number(cells[v]) || 0;
        }
      }
    }

    return {
      ...resultSource.value,
      rows: visibleRows,
      columnTotals: recalculatedColumnTotals,
      grandTotal: recalculatedGrandTotal,
    };
  }

  return {
    rowFields,
    columnField,
    valueColumns,
    columnKeys,
    columnTotals,
    grandTotal,
    rowDimCount,
    nestedHeaders,
    tableData,
    getVisibleResult,
  };
}
