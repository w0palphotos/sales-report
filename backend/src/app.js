import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import routes from './routes/index.js';

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

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.use(express.json({ limit: '10mb' }));
  app.use('/api/docs', createSwaggerRouter());
  app.use('/api', routes);
  app.use(errorHandler);
  return app;
}

export default createApp;
