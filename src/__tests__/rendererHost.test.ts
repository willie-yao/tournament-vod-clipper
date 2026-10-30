/** @jest-environment node */
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'fs/promises';
import os from 'os';
import path from 'path';
import http from 'http';
import { startRendererHost } from '../main/rendererHost';

let directory: string;
let host: Awaited<ReturnType<typeof startRendererHost>>;

function request(
  route: string,
  method = 'GET',
  authority?: string
): Promise<{
  status: number;
  body: string;
  headers: http.IncomingHttpHeaders;
}> {
  const url = new URL(host.url);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: url.port,
        path: route,
        method,
        headers: { Host: authority || url.host },
      },
      (response) => {
        let body = '';
        response.on('data', (data) => {
          body += data;
        });
        response.on('end', () =>
          resolve({
            status: response.statusCode!,
            body,
            headers: response.headers,
          })
        );
      }
    );
    req.on('error', reject);
    req.end();
  });
}

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'cutroom-host-'));
  await mkdir(path.join(directory, 'renderer'));
  await writeFile(
    path.join(directory, 'renderer/index.html'),
    '<div>Cutroom</div>'
  );
  await writeFile(path.join(directory, 'private.txt'), 'not public');
  host = await startRendererHost(path.join(directory, 'renderer'));
});
afterEach(async () => {
  await new Promise<void>((resolve, reject) =>
    host.server.close((error) => (error ? reject(error) : resolve()))
  );
  await rm(directory, { recursive: true, force: true });
});

it('serves only packaged assets on loopback with an intact embedding policy', async () => {
  expect(host.server.address()).toMatchObject({ address: '127.0.0.1' });
  const response = await request('/');
  expect(response.status).toBe(200);
  expect(response.body).toContain('Cutroom');
  expect(response.headers['content-security-policy']).toContain(
    "script-src 'self' https://player.twitch.tv"
  );
  expect(response.headers['content-security-policy']).not.toContain(
    'unsafe-eval'
  );
  expect(response.headers['access-control-allow-origin']).toBeUndefined();
  expect((await request('/', 'HEAD')).body).toBe('');
});

it('rejects foreign hosts, writes, traversal, missing files and symlink escapes', async () => {
  await symlink(
    path.join(directory, 'private.txt'),
    path.join(directory, 'renderer/escape.html')
  );
  expect((await request('/', 'GET', 'other.example')).status).toBe(403);
  expect((await request('/', 'POST')).status).toBe(403);
  expect((await request('/%2e%2e%2fprivate.txt')).status).toBe(403);
  expect((await request('/missing.js')).status).toBe(404);
  expect((await request('/escape.html')).status).toBe(403);
});
