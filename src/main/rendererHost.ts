import { createServer, Server } from 'http';
import { readFile, realpath } from 'fs/promises';
import path from 'path';

export const rendererCsp = [
  "default-src 'self'",
  "script-src 'self' https://player.twitch.tv",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://api.start.gg",
  'frame-src https://player.twitch.tv',
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

/** Give Twitch a web parent without exposing files or privileged IPC to frames. */
export async function startRendererHost(
  directory: string
): Promise<{ url: string; server: Server }> {
  const root = await realpath(directory);
  let authority = '';
  const server = createServer(async (request, response) => {
    response.setHeader('Content-Security-Policy', rendererCsp);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    if (
      request.headers.host !== authority ||
      !['GET', 'HEAD'].includes(request.method || '')
    ) {
      response.writeHead(403).end();
      return;
    }
    try {
      const url = new URL(request.url || '/', `http://${authority}`);
      const name = decodeURIComponent(url.pathname);
      const candidate = path.resolve(
        root,
        `.${name === '/' ? '/index.html' : name}`
      );
      if (!candidate.startsWith(`${root}${path.sep}`)) {
        response.writeHead(403).end();
        return;
      }
      const file = await realpath(candidate);
      const type = types[path.extname(file)];
      if (!file.startsWith(`${root}${path.sep}`) || !type) {
        response.writeHead(403).end();
        return;
      }
      const body = await readFile(file);
      response.writeHead(200, {
        'Content-Type': type,
        'Content-Length': body.length,
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
      response.writeHead(missing ? 404 : 400).end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Could not start the local renderer host.');
  }
  authority = `localhost:${address.port}`;
  return { url: `http://${authority}/index.html`, server };
}
