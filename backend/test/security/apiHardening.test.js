import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { reportSchema } from '../../src/services/reportService.js';
import { TEST_INTROSPECTION } from '../helpers.js';

const ALLOWED_ORIGIN = 'https://app.example';
const VALID_REPORT = { rows: ['city'], columns: [], values: [{ field: 'amount', aggregation: 'sum' }] };

let server;
let base;

before(async () => {
  // Schema diisi tanpa database supaya validasi tetap berjalan dengan field nyata.
  reportSchema.loadFromIntrospection(TEST_INTROSPECTION);

  server = createApp({
    allowedOrigins: [ALLOWED_ORIGIN],
    rateLimit: { max: 500, windowMs: 60_000 },
  }).listen(0);

  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

const postJson = (path, body, headers = {}) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('security: CORS hanya untuk origin terdaftar', () => {
  it('tanpa header Origin (same-origin) tidak ada header CORS', async () => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });

  it('origin asing tidak diizinkan', async () => {
    const res = await fetch(`${base}/api/health`, { headers: { Origin: 'https://jahat.example' } });
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });

  it('preflight dari origin asing tidak mendapat izin', async () => {
    const res = await fetch(`${base}/api/reports`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://jahat.example' },
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });

  it('origin terdaftar diizinkan', async () => {
    const res = await fetch(`${base}/api/health`, { headers: { Origin: ALLOWED_ORIGIN } });
    assert.equal(res.headers.get('access-control-allow-origin'), ALLOWED_ORIGIN);
    assert.equal(res.headers.get('vary'), 'Origin');
  });

  it('tidak membocorkan header x-powered-by', async () => {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.headers.get('x-powered-by'), null);
  });
});

describe('security: batas ukuran dan validasi input', () => {
  it('menolak body JSON yang terlalu besar (413)', async () => {
    const res = await postJson('/api/reports/saved', { name: 'x'.repeat(3 * 1024 * 1024) });
    assert.equal(res.status, 413);
  });

  it('menolak lebih dari 3 baris dan lebih dari 8 nilai', async () => {
    const tooManyRows = await postJson('/api/reports', {
      ...VALID_REPORT,
      rows: ['city', 'product', 'sales_name', 'amount'],
    });
    assert.equal(tooManyRows.status, 400);

    const tooManyValues = await postJson('/api/reports', {
      ...VALID_REPORT,
      values: Array.from({ length: 9 }, () => ({ field: 'amount', aggregation: 'sum' })),
    });
    assert.equal(tooManyValues.status, 400);
  });

  it('menolak field/agregasi asing tanpa menyentuh database', async () => {
    assert.equal((await postJson('/api/reports', { ...VALID_REPORT, rows: ['palsu'] })).status, 400);
    assert.equal(
      (await postJson('/api/reports', { ...VALID_REPORT, values: [{ field: 'amount', aggregation: 'median' }] })).status,
      400,
    );
  });

  it('menolak id laporan yang bukan bilangan bulat positif', async () => {
    for (const id of ['abc', '1 OR 1=1', '-3', '1;DROP TABLE sales']) {
      const res = await fetch(`${base}/api/reports/saved/${encodeURIComponent(id)}`);
      assert.equal(res.status, 400, `id harus ditolak: ${id}`);
    }
  });

  it('tidak bisa mencemari Object.prototype lewat body JSON', async () => {
    const raw = '{"rows":["city"],"columns":[],"values":[{"field":"amount","aggregation":"sum"}]}';
    const attack = `{"rows":["city"],"columns":[],"values":[{"field":"amount","aggregation":"sum"}],"__proto__":{"polluted":true}}`;

    const normal = await postJson('/api/reports', raw);
    const malicious = await postJson('/api/reports', attack);

    assert.equal(malicious.status, normal.status, 'kunci __proto__ tidak boleh mengubah perilaku');
    assert.equal({}.polluted, undefined);
  });
});

describe('security: respons error tidak membocorkan detail internal', () => {
  const fakeRes = () => ({
    headersSent: false,
    statusCode: 0,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  });

  it('error tak terduga menjadi 500 dengan pesan generik', () => {
    const res = fakeRes();
    const err = new Error('relation "sales" does not exist at /home/app/backend/src/services/reportService.js:38');

    errorHandler(err, {}, res, () => {});

    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.payload, { error: 'Terjadi kesalahan pada server.' });
    assert.equal(JSON.stringify(res.payload).includes('reportService'), false);
  });

  it('error 4xx tetap menyampaikan pesannya', () => {
    const res = fakeRes();
    const err = Object.assign(new Error('Konfigurasi laporan harus berupa objek.'), { status: 400 });

    errorHandler(err, {}, res, () => {});

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.payload, { error: 'Konfigurasi laporan harus berupa objek.' });
  });

  it('tidak menulis ulang response yang sudah terkirim', () => {
    const res = fakeRes();
    res.headersSent = true;

    errorHandler(new Error('boom'), {}, res, () => {});

    assert.equal(res.statusCode, 0);
    assert.equal(res.payload, null);
  });
});
