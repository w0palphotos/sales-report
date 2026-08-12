export function errorHandler(err, _req, res, _next) {
  const status = err.status ?? 500;

  if (status >= 500) {
    console.error(err);
  }

  if (res.headersSent) return;

  res.status(status).json({
    error: status < 500 && err.message ? err.message : 'Terjadi kesalahan pada server.',
  });
}
