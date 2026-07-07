import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const host = process.env.HOST || '0.0.0.0';
const port = Number.parseInt(process.env.PORT || '5002', 10);
const clientRoot = resolve(process.cwd(), 'dist/client');
const shellPath = join(clientRoot, '_shell.html');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function resolvePublicPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split('?')[0] || '/');
  const normalizedPath = normalize(decodedPath).replace(/^(\.\.[/\\])+/, '');
  const relativePath = normalizedPath === '/' ? '' : normalizedPath.replace(/^[/\\]+/, '');
  return join(clientRoot, relativePath);
}

async function fileExists(filePath) {
  try {
    const fileStat = await stat(filePath);
    return fileStat.isFile();
  } catch {
    return false;
  }
}

async function sendFile(response, filePath, statusCode = 200) {
  const extension = extname(filePath).toLowerCase();
  response.writeHead(statusCode, {
    'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    'Content-Type': contentTypes[extension] || 'application/octet-stream',
  });
  createReadStream(filePath).pipe(response);
}

const server = createServer(async (request, response) => {
  if (!request.url) {
    response.writeHead(400).end('Bad Request');
    return;
  }

  const requestPath = new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname;
  const resolvedPath = resolvePublicPath(requestPath);
  const isAssetRequest = extname(requestPath) !== '';

  try {
    await access(shellPath);

    if (await fileExists(resolvedPath)) {
      await sendFile(response, resolvedPath);
      return;
    }

    if (isAssetRequest) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found');
      return;
    }

    await sendFile(response, shellPath);
  } catch (error) {
    response
      .writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      .end(`Server error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

server.listen(port, host, () => {
  console.log(`Static SPA server listening at http://${host}:${port}`);
});
