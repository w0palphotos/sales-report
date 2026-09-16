function colToLetter(index) {
  let temp = index;
  let letter = '';
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

function escapeXml(unsafe) {
  return String(unsafe ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function buildXlsxBuffer(report) {
  // ponytail: lazy-load heavy excel libs so they stay out of the initial bundle
  const [{ default: ExcelJS }, { default: JSZip }] = await Promise.all([
    import('exceljs'),
    import('jszip'),
  ]);

  const { meta, columnKeys = [], rows = [], columnTotals = {}, grandTotal = [] } = report;
  const { rowFields = [], columnField = null, valueColumns = [] } = meta ?? {};
  const hasCol = Boolean(columnField);
  const valCount = valueColumns.length;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sales Report Builder';
  wb.created = new Date();

  const borderStyle = {
    top: { style: 'thin', color: { argb: 'FFE5E5E3' } },
    left: { style: 'thin', color: { argb: 'FFE5E5E3' } },
    bottom: { style: 'thin', color: { argb: 'FFE5E5E3' } },
    right: { style: 'thin', color: { argb: 'FFE5E5E3' } },
  };

  const headerFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF7F6F3' },
  };

  // 1. Sheet: Laporan Penjualan (Formatted Pivot Table)
  const wsPivot = wb.addWorksheet('Laporan Penjualan', {
    views: [{ showGridLines: true }],
  });

  if (hasCol) {
    // Row 1: Top Group Header
    const row1 = [];
    rowFields.forEach((rf) => row1.push(rf.label));
    for (const ck of columnKeys) {
      row1.push(ck);
      for (let v = 1; v < valCount; v++) row1.push('');
    }
    row1.push('Grand Total');
    for (let v = 1; v < valCount; v++) row1.push('');
    const r1 = wsPivot.addRow(row1);
    r1.font = { bold: true, name: 'Calibri', size: 11 };
    r1.fill = headerFill;

    // Row 2: Value Sub Headers
    const row2 = [];
    rowFields.forEach(() => row2.push(''));
    for (let c = 0; c < columnKeys.length; c++) {
      for (const vc of valueColumns) {
        row2.push(vc.label);
      }
    }
    for (const vc of valueColumns) {
      row2.push(vc.label);
    }
    const r2 = wsPivot.addRow(row2);
    r2.font = { bold: true, name: 'Calibri', size: 11 };
    r2.fill = headerFill;

    // Merges for row fields (rows 1-2)
    for (let i = 0; i < rowFields.length; i++) {
      const colLetter = colToLetter(i + 1);
      wsPivot.mergeCells(`${colLetter}1:${colLetter}2`);
    }
    // Merges for column keys
    let cOffset = rowFields.length + 1;
    for (const _ck of columnKeys) {
      if (valCount > 1) {
        wsPivot.mergeCells(`${colToLetter(cOffset)}1:${colToLetter(cOffset + valCount - 1)}1`);
      }
      cOffset += Math.max(1, valCount);
    }
    // Merges for Grand Total column
    if (valCount > 1) {
      wsPivot.mergeCells(`${colToLetter(cOffset)}1:${colToLetter(cOffset + valCount - 1)}1`);
    }
  } else {
    // Single header row
    const row1 = [
      ...rowFields.map((rf) => rf.label),
      ...valueColumns.map((vc) => vc.label),
    ];
    const r1 = wsPivot.addRow(row1);
    r1.font = { bold: true, name: 'Calibri', size: 11 };
    r1.fill = headerFill;
  }

  // Data rows for Laporan Penjualan
  for (const row of rows) {
    const line = [];
    for (const rf of rowFields) {
      line.push(row.key[rf.key] ?? '');
    }
    if (hasCol) {
      for (const ck of columnKeys) {
        const cells = row.cells[ck] ?? [];
        line.push(...cells);
      }
      line.push(...(row.rowTotal ?? []));
    } else {
      line.push(...(row.cells['__all__'] ?? []));
    }
    const addedRow = wsPivot.addRow(line);
    for (let colIdx = 1; colIdx <= line.length; colIdx++) {
      const cell = addedRow.getCell(colIdx);
      if (typeof cell.value === 'number') {
        cell.numFmt = '#,##0';
      }
    }
  }

  // Grand Total footer row
  const footer = [];
  rowFields.forEach((_, i) => {
    footer.push(i === 0 ? 'Grand Total' : '');
  });
  if (hasCol) {
    for (const ck of columnKeys) {
      const colTot = columnTotals[ck] ?? [];
      footer.push(...colTot);
    }
    footer.push(...grandTotal);
  } else {
    footer.push(...grandTotal);
  }
  const fRow = wsPivot.addRow(footer);
  fRow.font = { bold: true, name: 'Calibri', size: 11 };
  fRow.fill = headerFill;
  for (let colIdx = rowFields.length + 1; colIdx <= footer.length; colIdx++) {
    const cell = fRow.getCell(colIdx);
    if (typeof cell.value === 'number') {
      cell.numFmt = '#,##0';
    }
  }

  // Column widths and borders for Laporan Penjualan
  wsPivot.columns.forEach((col) => {
    col.width = 20;
  });
  wsPivot.eachRow((r) => {
    r.eachCell((c) => {
      c.border = borderStyle;
    });
  });

  // 2. Sheet: Visualisasi (Flat Table + Interactive OpenXML Chart)
  const wsViz = wb.addWorksheet('Visualisasi', {
    views: [{ showGridLines: true }],
  });

  const categoryHeader = rowFields.map((rf) => rf.label).join(' · ') || 'Kategori';
  const categories = rows.map((row) =>
    rowFields.map((field) => row.key[field.key]).join(' · ') || 'Item',
  );

  let seriesList = [];
  let vizHeader = [categoryHeader];

  if (hasCol) {
    vizHeader.push(...columnKeys);
    seriesList = columnKeys.map((ck, i) => ({
      name: ck,
      colIndex: i + 2,
      colLetter: colToLetter(i + 2),
      data: rows.map((row) => (row.cells[ck] ? row.cells[ck][0] : 0)),
    }));
  } else {
    const valLabels = valueColumns.map((vc) => vc.label);
    vizHeader.push(...valLabels);
    seriesList = valueColumns.map((vc, i) => ({
      name: vc.label,
      colIndex: i + 2,
      colLetter: colToLetter(i + 2),
      data: rows.map((row) => (row.cells['__all__'] ? row.cells['__all__'][i] : 0)),
    }));
  }

  const vhRow = wsViz.addRow(vizHeader);
  vhRow.font = { bold: true, name: 'Calibri', size: 11 };
  vhRow.fill = headerFill;

  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const rowData = [categories[rIdx], ...seriesList.map((s) => s.data[rIdx] ?? 0)];
    const vRow = wsViz.addRow(rowData);
    for (let c = 2; c <= rowData.length; c++) {
      const cell = vRow.getCell(c);
      if (typeof cell.value === 'number') {
        cell.numFmt = '#,##0';
      }
    }
  }

  wsViz.columns.forEach((col) => {
    col.width = 22;
  });
  wsViz.eachRow((r) => {
    r.eachCell((c) => {
      c.border = borderStyle;
    });
  });

  const rawBuf = await wb.xlsx.writeBuffer();
  const zip = await JSZip.loadAsync(rawBuf);

  if (rows.length === 0 || seriesList.length === 0) {
    return zip.generateAsync({ type: 'blob' });
  }

  // Inject Native OpenXML Chart bound to Visualisasi cells
  const paletteHex = ['2F3437', '1F6C9F', '346538', '956400', '9F2F2D', '787774'];
  const numRows = rows.length;
  const startRow = 2;
  const endRow = startRow + numRows - 1;

  const serXml = seriesList
    .map((ser, sIdx) => {
      const colLet = ser.colLetter;
      const catRange = `'Visualisasi'!$A$${startRow}:$A$${endRow}`;
      const valRange = `'Visualisasi'!$${colLet}$${startRow}:$${colLet}$${endRow}`;
      const nameCell = `'Visualisasi'!$${colLet}$1`;

      const catCache = categories
        .map((cat, i) => `<c:pt idx="${i}"><c:v>${escapeXml(cat)}</c:v></c:pt>`)
        .join('');
      const valCache = ser.data
        .map((val, i) => `<c:pt idx="${i}"><c:v>${Number(val) || 0}</c:v></c:pt>`)
        .join('');
      const color = paletteHex[sIdx % paletteHex.length];

      return `
        <c:ser>
          <c:idx val="${sIdx}"/>
          <c:order val="${sIdx}"/>
          <c:tx>
            <c:strRef>
              <c:f>${nameCell}</c:f>
              <c:strCache>
                <c:ptCount val="1"/>
                <c:pt idx="0"><c:v>${escapeXml(ser.name)}</c:v></c:pt>
              </c:strCache>
            </c:strRef>
          </c:tx>
          <c:spPr>
            <a:solidFill>
              <a:srgbClr val="${color}"/>
            </a:solidFill>
          </c:spPr>
          <c:cat>
            <c:strRef>
              <c:f>${catRange}</c:f>
              <c:strCache>
                <c:ptCount val="${numRows}"/>
                ${catCache}
              </c:strCache>
            </c:strRef>
          </c:cat>
          <c:val>
            <c:numRef>
              <c:f>${valRange}</c:f>
              <c:numCache>
                <c:formatCode>#,##0</c:formatCode>
                <c:ptCount val="${numRows}"/>
                ${valCache}
              </c:numCache>
            </c:numRef>
          </c:val>
        </c:ser>`;
    })
    .join('');

  const chartXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title>
      <c:tx>
        <c:rich>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:pPr>
              <a:defRPr sz="1400" b="1"/>
            </a:pPr>
            <a:r>
              <a:rPr lang="id-ID" sz="1400" b="1"/>
              <a:t>Visualisasi Penjualan</a:t>
            </a:r>
          </a:p>
        </c:rich>
      </c:tx>
      <c:layout/>
      <c:overlay val="0"/>
    </c:title>
    <c:autoTitleDeleted val="0"/>
    <c:plotArea>
      <c:layout/>
      <c:barChart>
        <c:barDir val="col"/>
        <c:grouping val="clustered"/>
        <c:varyColors val="0"/>
        ${serXml}
        <c:axId val="148921728"/>
        <c:axId val="154211840"/>
      </c:barChart>
      <c:catAx>
        <c:axId val="148921728"/>
        <c:scaling>
          <c:orientation val="minMax"/>
        </c:scaling>
        <c:delete val="0"/>
        <c:axPos val="b"/>
        <c:majorTickMark val="none"/>
        <c:minorTickMark val="none"/>
        <c:tickLblPos val="nextTo"/>
        <c:crossAx val="154211840"/>
        <c:crosses val="autoZero"/>
        <c:auto val="1"/>
        <c:lblAlgn val="ctr"/>
        <c:lblOffset val="100"/>
      </c:catAx>
      <c:valAx>
        <c:axId val="154211840"/>
        <c:scaling>
          <c:orientation val="minMax"/>
        </c:scaling>
        <c:delete val="0"/>
        <c:axPos val="l"/>
        <c:majorGridlines/>
        <c:numFmt formatCode="#,##0" sourceLinked="0"/>
        <c:majorTickMark val="none"/>
        <c:minorTickMark val="none"/>
        <c:tickLblPos val="nextTo"/>
        <c:crossAx val="148921728"/>
        <c:crosses val="autoZero"/>
        <c:crossBetween val="between"/>
      </c:valAx>
    </c:plotArea>
    <c:legend>
      <c:legendPos val="b"/>
      <c:layout/>
      <c:overlay val="0"/>
    </c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`;

  zip.file('xl/charts/chart1.xml', chartXml);

  const startCol = seriesList.length + 2;
  const endCol = startCol + 11;

  const drawingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <xdr:twoCellAnchor>
    <xdr:from>
      <xdr:col>${startCol}</xdr:col>
      <xdr:colOff>0</xdr:colOff>
      <xdr:row>1</xdr:row>
      <xdr:rowOff>0</xdr:rowOff>
    </xdr:from>
    <xdr:to>
      <xdr:col>${endCol}</xdr:col>
      <xdr:colOff>0</xdr:colOff>
      <xdr:row>18</xdr:row>
      <xdr:rowOff>0</xdr:rowOff>
    </xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr>
        <xdr:cNvPr id="2" name="Chart 1"/>
        <xdr:cNvGraphicFramePr/>
      </xdr:nvGraphicFramePr>
      <xdr:xfrm>
        <a:off x="0" y="0"/>
        <a:ext cx="0" cy="0"/>
      </xdr:xfrm>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
          <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/>
        </a:graphicData>
      </a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>`;

  zip.file('xl/drawings/drawing1.xml', drawingXml);

  const drawingRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
</Relationships>`;
  zip.file('xl/drawings/_rels/drawing1.xml.rels', drawingRels);

  const sheet2Rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`;
  zip.file('xl/worksheets/_rels/sheet2.xml.rels', sheet2Rels);

  let sheet2Xml = await zip.file('xl/worksheets/sheet2.xml').async('text');
  if (!sheet2Xml.includes('<drawing')) {
    sheet2Xml = sheet2Xml.replace('</worksheet>', '<drawing r:id="rId1"/></worksheet>');
    zip.file('xl/worksheets/sheet2.xml', sheet2Xml);
  }

  let contentTypes = await zip.file('[Content_Types].xml').async('text');
  if (!contentTypes.includes('chart1.xml')) {
    const additions = `<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`;
    contentTypes = contentTypes.replace('</Types>', additions + '</Types>');
    zip.file('[Content_Types].xml', contentTypes);
  }

  return zip.generateAsync({ type: 'blob' });
}

export async function parseXlsxBuffer(buffer) {
  const [{ default: ExcelJS }] = await Promise.all([import('exceljs')]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  const json = [];
  const headers = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value ?? '').trim();
      });
    } else {
      const rowObj = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) {
          rowObj[header] = cell.value;
        }
      });
      json.push(rowObj);
    }
  });
  return json;
}
