import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staticRoot = path.resolve(
  process.env.LEGACY_DIST_DIR ??
    path.join(projectRoot, '..', 'aqua_viewer', 'dist', 'aqua-viewer', 'browser'),
);
const certFile = process.env.PARITY_CERT_FILE ?? path.join(projectRoot, 'ssl', 'portal.naominet.live.crt');
const keyFile = process.env.PARITY_KEY_FILE ?? path.join(projectRoot, 'ssl', 'portal.naominet.live.key');
const apiTarget = new URL(process.env.PARITY_API_TARGET ?? 'http://aqua.naominet.live');
const port = Number(process.env.LEGACY_PORT ?? 4201);

for (const requiredPath of [staticRoot, certFile, keyFile]) {
  if (!fs.existsSync(requiredPath)) {
    throw new Error(`Legacy parity prerequisite is missing: ${requiredPath}`);
  }
}

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function proxyRequest(request, response) {
  const upstream = http.request(
    {
      hostname: apiTarget.hostname,
      port: apiTarget.port || 80,
      path: request.url,
      method: request.method,
      headers: { ...request.headers, host: apiTarget.host },
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );

  upstream.on('error', (error) => {
    response.statusCode = 502;
    response.end(`Legacy API proxy failed: ${error.message}`);
  });
  request.pipe(upstream);
}

function serveStatic(request, response) {
  const requestPath = decodeURIComponent(new URL(request.url ?? '/', 'https://parity.local').pathname);
  let filePath = path.resolve(staticRoot, requestPath === '/' ? 'index.html' : requestPath.slice(1));

  if (filePath !== staticRoot && !filePath.startsWith(`${staticRoot}${path.sep}`)) {
    response.statusCode = 403;
    response.end('Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      filePath = path.join(staticRoot, 'index.html');
    }

    fs.readFile(filePath, (readError, body) => {
      if (readError) {
        response.statusCode = 500;
        response.end(readError.message);
        return;
      }

      response.setHeader('Content-Type', contentTypes.get(path.extname(filePath)) ?? 'application/octet-stream');
      response.end(body);
    });
  });
}

const server = https.createServer(
  {
    cert: fs.readFileSync(certFile),
    key: fs.readFileSync(keyFile),
  },
  (request, response) => {
    if (request.url?.startsWith('/api') || request.url?.startsWith('/Maimai2Servlet')) {
      proxyRequest(request, response);
      return;
    }

    serveStatic(request, response);
  },
);

server.listen(port, '127.0.0.1', () => {
  console.log(`Legacy Angular baseline: https://portal.naominet.live:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
