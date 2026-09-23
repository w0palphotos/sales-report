// CORS hanya untuk origin yang diizinkan. Secara default tidak ada header CORS
// sama sekali, karena aplikasi ini juga bisa di-deploy same-origin (SPA dan /api
// dalam satu project, lihat README).
//
// Isi ALLOWED_ORIGINS (dipisah koma) bila frontend dan API berada di origin
// berbeda, mis.
//   ALLOWED_ORIGINS=https://app.example,https://app-*.vercel.app
// Pola `*` hanya cocok di dalam satu label host (tidak melewati "/"), sehingga
// `https://app-*.vercel.app` bisa untuk preview deployment tanpa membuka
// seluruh domain vercel.app.
const parseOrigins = (value) =>
  String(value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    // Wajib berupa origin lengkap dengan skema; "*" saja tidak dianggap pola.
    .filter((origin) => origin.includes('://'));

const originMatcher = (pattern) => {
  if (!pattern.includes('*')) return (origin) => origin === pattern;

  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  const regex = new RegExp(`^${escaped}$`);
  return (origin) => regex.test(origin);
};

export function corsPolicy({ allowedOrigins } = {}) {
  const patterns = allowedOrigins ?? parseOrigins(process.env.ALLOWED_ORIGINS);
  const matchers = patterns.map(originMatcher);

  return (req, res, next) => {
    const { origin } = req.headers;

    if (origin && matchers.some((matches) => matches(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    } else if (origin && req.method === 'OPTIONS') {
      // Membantu saat setup: origin mana yang ditolak dan daftar yang diizinkan.
      console.warn(
        `[cors] origin ditolak: ${origin} (ALLOWED_ORIGINS: ${patterns.join(', ') || 'kosong'})`,
      );
    }

    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  };
}
