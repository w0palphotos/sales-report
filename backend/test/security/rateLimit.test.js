import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.js';

// Batas kecil supaya perilakunya cepat teruji.
const LIMIT = 3;
const FORWARDED_IP = '203.0.113.9';

let server;
let base;

before(async () => {
  server = createApp({ rateLimit: { max: LIMIT, windowMs: 60_000 } }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

describe('security: pembatas permintaan (rate limit)', () => {
  it('menolak permintaan berlebih dengan 429 + Retry-After', async () => {
    const statuses = [];

    for (let i = 0; i < LIMIT + 2; i++) {
      const res = await fetch(`${base}/api/health`);
      statuses.push(res.status);

      if (res.status === 429) {
        assert.ok(Number(res.headers.get('retry-after')) >= 1, 'Retry-After harus diisi');
        const body = await res.json();
        assert.match(body.error, /Terlalu banyak permintaan/);
      }
    }

    assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
  });

  it('perhitungannya per alamat IP (klien lain tidak ikut terblokir)', async () => {
    const res = await fetch(`${base}/api/health`, { headers: { 'x-forwarded-for': FORWARDED_IP } });
    assert.equal(res.status, 200);
  });

  it('batas juga berlaku untuk endpoint data, bukan hanya /health', async () => {
    const headers = { 'x-forwarded-for': '198.51.100.7' };
    const statuses = [];

    for (let i = 0; i < LIMIT + 1; i++) {
      const res = await fetch(`${base}/api/reports/saved`, { headers });
      statuses.push(res.status);
    }

    assert.equal(statuses.at(-1), 429);
  });
});
