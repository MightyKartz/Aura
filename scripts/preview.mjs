import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.cwd(), 'dist');
const port = Number(process.env.AURA_PREVIEW_PORT || 4173);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

function safeResolve(urlPath) {
  const pathname = decodeURIComponent(String(urlPath || '/').split('?')[0]);
  const relativePath = pathname === '/' ? '/skin-studio.html' : pathname;
  const normalizedPath = normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
  return join(root, normalizedPath);
}

const server = createServer((request, response) => {
  if (request.url === '/favicon.ico') {
    response.writeHead(204);
    response.end();
    return;
  }

  const filePath = safeResolve(request.url);

  if (!filePath.startsWith(root) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': MIME_TYPES[extname(filePath)] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });

  createReadStream(filePath).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Aura preview server running at http://127.0.0.1:${port}/skin-studio.html`);
});
