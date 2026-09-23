import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import routes from './routes/index.js';
import { corsPolicy } from './middleware/cors.js';
import { rateLimit } from './middleware/rateLimit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const swaggerDocument = JSON.parse(fs.readFileSync(path.join(__dirname, 'openapi.json'), 'utf8'));

import { errorHandler } from './middleware/errorHandler.js';

const SWAGGER_CDN = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.32.12';

function swaggerInitScript() {
  const options = JSON.stringify({ swaggerDoc: swaggerDocument });
  return `
window.onload = function() {
  var url = window.location.search.match(/url=([^&]+)/);
  if (url && url.length > 1) {
    url = decodeURIComponent(url[1]);
  } else {
    url = window.location.origin;
  }
  var options = ${options};
  url = options.swaggerUrl || url
  var urls = options.swaggerUrls
  var spec1 = options.swaggerDoc
  var swaggerOptions = {
    spec: spec1,
    url: url,
    urls: urls,
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset
    ],
    plugins: [
      SwaggerUIBundle.plugins.DownloadUrl
    ],
    layout: "StandaloneLayout"
  }
  var ui = SwaggerUIBundle(swaggerOptions)
  window.ui = ui
}
`;
}

function createSwaggerRouter() {
  const router = express.Router();

  router.get('/', (_req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sales Insight Report Builder API - Swagger UI</title>
  <link rel="stylesheet" type="text/css" href="${SWAGGER_CDN}/swagger-ui.css" >
  <style>
    html { box-sizing: border-box; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin:0; background: #fafafa; }
  </style>
</head>
<body>
<div id="swagger-ui"></div>
<script src="${SWAGGER_CDN}/swagger-ui-bundle.js"></script>
<script src="${SWAGGER_CDN}/swagger-ui-standalone-preset.js"></script>
<script src="/api/docs/swagger-ui-init.js"></script>
</body>
</html>
`);
  });

  router.get('/swagger-ui-init.js', (_req, res) => {
    res.set('Content-Type', 'application/javascript');
    res.send(swaggerInitScript());
  });

  return router;
}

const TRUST_PROXY_HOPS = Number(process.env.TRUST_PROXY ?? 1);
const parsedBodyLimit = process.env.JSON_BODY_LIMIT ?? '2mb';

export function createApp({ rateLimit: rateLimitOptions, allowedOrigins } = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Di belakang proxy (Vercel) IP asli ada di X-Forwarded-For, jadi pembatas
  // permintaan bisa membedakan tiap klien.
  app.set('trust proxy', Number.isFinite(TRUST_PROXY_HOPS) ? TRUST_PROXY_HOPS : 1);

  app.use(corsPolicy({ allowedOrigins }));
  app.use(rateLimit(rateLimitOptions));
  app.use(express.json({ limit: parsedBodyLimit }));

  app.use('/api/docs', createSwaggerRouter());
  app.use('/api', routes);
  app.use(errorHandler);
  return app;
}

export default createApp;
