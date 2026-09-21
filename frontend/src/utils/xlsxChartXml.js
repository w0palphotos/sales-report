// OpenXML chart injection for .xlsx exports.
// ExcelJS cannot author charts, so the chart/drawing XML is built here
// and patched into the workbook ZIP produced by ExcelJS.
// All raw XML lives in this file; xlsxExport.js only calls injectNativeChart().

const REL_TYPE = {
  chart: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart',
  drawing: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing',
};

const AXIS_ID_CAT = 148921728;
const AXIS_ID_VAL = 154211840;

const PALETTE = ['2F3437', '1F6C9F', '346538', '956400', '9F2F2D', '787774'];

// Satu sheet saja: tabel pivot dan chart menyatu di "Laporan Penjualan".
const SHEET_NAME = 'Laporan Penjualan';
const SHEET_PATH = 'xl/worksheets/sheet1.xml';
const DRAWING_PATH = 'xl/drawings/drawing1.xml';
const DRAWING_RELS_PATH = 'xl/drawings/_rels/drawing1.xml.rels';
const SHEET_RELS_PATH = 'xl/worksheets/_rels/sheet1.xml.rels';
const CHART_PATH = 'xl/charts/chart1.xml';
const CONTENT_TYPES_PATH = '[Content_Types].xml';

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cachePoints(items, toValue) {
  return items.map((item, i) => `<c:pt idx="${i}"><c:v>${toValue(item)}</c:v></c:pt>`).join('');
}

// One <c:ser> block: name + color + category range + value range.
// catRange is identical for every series, so the caller computes it once.
function seriesXml(series, index, catRange, geom, numRows, categories) {
  const valRange = `'${SHEET_NAME}'!$${series.colLetter}$${geom.startRow}:$${series.colLetter}$${geom.endRow}`;
  const nameCell = `'${SHEET_NAME}'!$${series.colLetter}$${geom.headerRow}`;
  const color = PALETTE[index % PALETTE.length];

  return `
        <c:ser>
          <c:idx val="${index}"/>
          <c:order val="${index}"/>
          <c:tx>
            <c:strRef>
              <c:f>${nameCell}</c:f>
              <c:strCache>
                <c:ptCount val="1"/>
                <c:pt idx="0"><c:v>${escapeXml(series.name)}</c:v></c:pt>
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
                ${cachePoints(categories, (cat) => escapeXml(cat))}
              </c:strCache>
            </c:strRef>
          </c:cat>
          <c:val>
            <c:numRef>
              <c:f>${valRange}</c:f>
              <c:numCache>
                <c:formatCode>#,##0</c:formatCode>
                <c:ptCount val="${numRows}"/>
                ${cachePoints(series.data, (val) => Number(val) || 0)}
              </c:numCache>
            </c:numRef>
          </c:val>
        </c:ser>`;
}

function chartXml(title, seriesList, categories, geom) {
  const numRows = categories.length;
  const catRange = `'${SHEET_NAME}'!$A$${geom.startRow}:$A$${geom.endRow}`;
  const serBlocks = seriesList
    .map((series, i) => seriesXml(series, i, catRange, geom, numRows, categories))
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
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
              <a:t>${escapeXml(title)}</a:t>
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
        ${serBlocks}
        <c:axId val="${AXIS_ID_CAT}"/>
        <c:axId val="${AXIS_ID_VAL}"/>
      </c:barChart>
      <c:catAx>
        <c:axId val="${AXIS_ID_CAT}"/>
        <c:scaling>
          <c:orientation val="minMax"/>
        </c:scaling>
        <c:delete val="0"/>
        <c:axPos val="b"/>
        <c:majorTickMark val="none"/>
        <c:minorTickMark val="none"/>
        <c:tickLblPos val="nextTo"/>
        <c:crossAx val="${AXIS_ID_VAL}"/>
        <c:crosses val="autoZero"/>
        <c:auto val="1"/>
        <c:lblAlgn val="ctr"/>
        <c:lblOffset val="100"/>
      </c:catAx>
      <c:valAx>
        <c:axId val="${AXIS_ID_VAL}"/>
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
        <c:crossAx val="${AXIS_ID_CAT}"/>
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
}

function drawingXml(geom) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <xdr:twoCellAnchor>
    <xdr:from>
      <xdr:col>${geom.anchorFromCol}</xdr:col>
      <xdr:colOff>0</xdr:colOff>
      <xdr:row>${geom.anchorRowStart}</xdr:row>
      <xdr:rowOff>0</xdr:rowOff>
    </xdr:from>
    <xdr:to>
      <xdr:col>${geom.anchorEndCol}</xdr:col>
      <xdr:colOff>0</xdr:colOff>
      <xdr:row>${geom.anchorRowEnd}</xdr:row>
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
}

const RELS_HEADER =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';

function relFragment(id, type, target) {
  return `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`;
}

function relsDoc(fragment) {
  return `${RELS_HEADER}${fragment}</Relationships>`;
}

async function patchSheetDrawing(zip) {
  const sheetXml = await zip.file(SHEET_PATH).async('text');
  if (!sheetXml.includes('<drawing')) {
    zip.file(SHEET_PATH, sheetXml.replace('</worksheet>', '<drawing r:id="rId1"/></worksheet>'));
  }
}

// Merge into an existing sheet rels file when present, so we do not drop
// other relationships ExcelJS may have written.
async function patchSheetRels(zip, fragment) {
  const existing = zip.file(SHEET_RELS_PATH);
  if (!existing) {
    zip.file(SHEET_RELS_PATH, relsDoc(fragment));
    return;
  }
  const xml = await existing.async('text');
  if (xml.includes('drawing1.xml')) return;
  zip.file(SHEET_RELS_PATH, xml.replace('</Relationships>', `${fragment}</Relationships>`));
}

async function patchContentTypes(zip) {
  const xml = await zip.file(CONTENT_TYPES_PATH).async('text');
  if (!xml.includes('chart1.xml')) {
    const additions =
      `<Override PartName="/${CHART_PATH}" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>` +
      `<Override PartName="/${DRAWING_PATH}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`;
    zip.file(CONTENT_TYPES_PATH, xml.replace('</Types>', `${additions}</Types>`));
  }
}

// Main entry: inject a native clustered column chart bound to the flat chart
// block on the same "Laporan Penjualan" sheet. Returns false when there is
// nothing to chart (caller still produces a valid .xlsx, just without a chart).
export async function injectNativeChart(zip, { seriesList, categories, geom, title = 'Visualisasi Penjualan' }) {
  if (categories.length === 0 || seriesList.length === 0) return false;

  zip.file(CHART_PATH, chartXml(title, seriesList, categories, geom));
  zip.file(DRAWING_PATH, drawingXml(geom));
  zip.file(DRAWING_RELS_PATH, relsDoc(relFragment('rId1', REL_TYPE.chart, '../charts/chart1.xml')));

  await patchSheetRels(zip, relFragment('rId1', REL_TYPE.drawing, '../drawings/drawing1.xml'));
  await patchSheetDrawing(zip);
  await patchContentTypes(zip);
  return true;
}
