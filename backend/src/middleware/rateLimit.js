// Pembatas permintaan sederhana (sliding window) per alamat IP.
//
// State-nya di memori proses. Di Vercel (serverless, banyak instance) ini hanya
// best-effort — proteksi menyeluruh tetap butuh rate limit di edge/WAF.
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX = 120;
const SWEEP_THRESHOLD = 5_000;

const positiveNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

export function rateLimit({ windowMs, max } = {}) {
  const windowMsValue = positiveNumber(windowMs ?? process.env.RATE_LIMIT_WINDOW_MS) ?? DEFAULT_WINDOW_MS;
  const maxValue = positiveNumber(max ?? process.env.RATE_LIMIT_MAX) ?? DEFAULT_MAX;
  const hits = new Map();

  const sweep = (now) => {
    for (const [key, times] of hits) {
      const recent = times.filter((at) => now - at < windowMsValue);
      if (recent.length === 0) hits.delete(key);
      else hits.set(key, recent);
    }
  };

  return (req, res, next) => {
    const now = Date.now();
    if (hits.size > SWEEP_THRESHOLD) sweep(now);

    const key = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const times = (hits.get(key) ?? []).filter((at) => now - at < windowMsValue);

    if (times.length >= maxValue) {
      hits.set(key, times);
      const retryAfter = Math.ceil((windowMsValue - (now - times[0])) / 1000);
      res.setHeader('Retry-After', String(Math.max(1, retryAfter)));
      return res.status(429).json({ error: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.' });
    }

    times.push(now);
    hits.set(key, times);
    next();
  };
}
