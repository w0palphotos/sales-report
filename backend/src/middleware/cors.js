// CORS hanya untuk origin yang diizinkan. Secara default tidak ada header CORS
// sama sekali, karena aplikasi ini dirancang same-origin (SPA dan /api di domain
// yang sama, lihat README). Isi ALLOWED_ORIGINS (dipisah koma) bila frontend dan
// API memang berada di origin berbeda.
const parseOrigins = (value) =>
  String(value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

export function corsPolicy({ allowedOrigins } = {}) {
  const allowed = allowedOrigins ?? parseOrigins(process.env.ALLOWED_ORIGINS);

  return (req, res, next) => {
    const { origin } = req.headers;

    if (origin && allowed.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  };
}
