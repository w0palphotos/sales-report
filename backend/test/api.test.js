import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

const hasDb = Boolean(process.env.DATABASE_URL);

let server;
let base;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

const postJson = (path, body) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const REPORT_CONFIG = {
  rows: ['city'],
  columns: [],
  values: [{ field: 'amount', aggregation: 'sum' }],
};

describe('API tanpa database', () => {
  it('GET /api/health mengembalikan 200', async () => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
  });

  it('POST /api/reports menolak konfigurasi tidak valid dengan 400', async () => {
    const res = await postJson('/api/reports', { rows: [], columns: [], values: [{ field: 'amount', aggregation: 'sum' }] });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error);
  });

  it('POST /api/reports menolak field tidak dikenal dengan 400', async () => {
    const res = await postJson('/api/reports', { rows: ['palsu'], columns: [], values: [{ field: 'amount', aggregation: 'sum' }] });
    assert.equal(res.status, 400);
  });
});

describe('API dengan database terhubung', { skip: !hasDb }, () => {
  it('GET /api/meta/fields mengembalikan dimensi, ukuran, perhitungan, operator', async () => {
    const res = await fetch(`${base}/api/meta/fields`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.dimensions.some((d) => d.key === 'city' && d.values.includes('Jakarta')));
    assert.ok(body.measures.some((m) => m.key === 'amount'));
    assert.ok(body.aggregations.some((a) => a.key === 'sum'));
    assert.ok(body.operators.some((o) => o.key === 'between'));
  });

  it('POST /api/reports menghasilkan laporan pivot dengan total', async () => {
    const res = await postJson('/api/reports', REPORT_CONFIG);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.rows));
    assert.deepEqual(body.grandTotal, [615_000_000]);
  });

  it('POST /api/reports/export mengembalikan CSV', async () => {
    const res = await postJson('/api/reports/export', REPORT_CONFIG);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/csv/);
    const text = await res.text();
    assert.match(text, /Total Penjualan/);
    assert.match(text, /615000000/);
  });

  it('CRUD laporan tersimpan', async () => {
    const createdRes = await postJson('/api/reports/saved', {
      name: 'Laporan Tes',
      config: REPORT_CONFIG,
    });
    assert.equal(createdRes.status, 201);
    const created = await createdRes.json();
    assert.ok(created.id);

    const listRes = await fetch(`${base}/api/reports/saved`);
    assert.equal(listRes.status, 200);
    const list = await listRes.json();
    assert.ok(list.reports.some((r) => r.id === created.id));

    const getRes = await fetch(`${base}/api/reports/saved/${created.id}`);
    assert.equal(getRes.status, 200);
    assert.equal((await getRes.json()).name, 'Laporan Tes');

    const updateRes = await fetch(`${base}/api/reports/saved/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Laporan Diperbarui', config: REPORT_CONFIG }),
    });
    assert.equal(updateRes.status, 200);

    const delRes = await fetch(`${base}/api/reports/saved/${created.id}`, { method: 'DELETE' });
    assert.equal(delRes.status, 204);

    const missingRes = await fetch(`${base}/api/reports/saved/${created.id}`);
    assert.equal(missingRes.status, 404);
  });
});
