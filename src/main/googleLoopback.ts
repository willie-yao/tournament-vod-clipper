/* eslint @typescript-eslint/no-use-before-define: ["error", { "functions": false }] */
import { createHash, randomBytes } from 'crypto';
import { createServer } from 'http';

interface Authorization {
  redirectUri: string;
  state: string;
  challenge: string;
}

export class GoogleAuthError extends Error {
  constructor(message: string, readonly code?: number) {
    super(message);
  }
}

/** Receive one authorization response on a temporary, loopback-only listener. */
export default function googleLoopback(
  openBrowser: (authorization: Authorization) => Promise<void>,
  signal: AbortSignal,
  timeoutMs = 180_000
): Promise<{ code: string; redirectUri: string; verifier: string }> {
  const verifier = randomBytes(32).toString('base64url');
  const state = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');

  return new Promise((resolve, reject) => {
    let settled = false;
    let redirectUri = '';
    const server = createServer((request, response) => {
      const callback = new URL(redirectUri);
      const target = request.url;
      response.setHeader('Content-Type', 'text/plain; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      if (
        request.method !== 'GET' ||
        request.headers.host !== callback.host ||
        !target ||
        target.split('?')[0] !== callback.pathname
      ) {
        response.writeHead(404).end('Not found.');
        return;
      }
      const url = new URL(target, callback.origin);
      const validState =
        url.searchParams.getAll('state').length === 1 &&
        url.searchParams.get('state') === state;
      const code = url.searchParams.get('code') || '';
      const denied = url.searchParams.has('error');
      if (
        !validState ||
        (!denied && (!code || url.searchParams.getAll('code').length !== 1)) ||
        (denied &&
          (url.searchParams.getAll('error').length !== 1 ||
            url.searchParams.has('code')))
      ) {
        response
          .writeHead(400)
          .end('Invalid sign-in response. Return to the app.');
        finish(
          new GoogleAuthError(
            'Google sign-in returned an invalid response. Try connecting again.'
          )
        );
        return;
      }
      response.end(
        denied
          ? 'Sign-in was not approved. You can return to Tournament VOD Clipper.'
          : 'Sign-in received. You can return to Tournament VOD Clipper.'
      );
      if (denied) {
        finish(
          new GoogleAuthError(
            'Google sign-in was not approved. No connection was saved.'
          )
        );
      } else {
        finish({ code });
      }
    });
    const timer = setTimeout(
      () =>
        finish(
          new GoogleAuthError(
            'Google sign-in timed out. Connect again when ready.'
          )
        ),
      timeoutMs
    );
    const cancel = () =>
      finish(new GoogleAuthError('Google sign-in was canceled.'));

    function finish(result: Error | { code: string }) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      server.close();
      server.closeAllConnections();
      if (result instanceof Error) reject(result);
      else resolve({ code: result.code, redirectUri, verifier });
    }

    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) {
      cancel();
      return;
    }
    server.on('error', () =>
      finish(
        new GoogleAuthError(
          'Could not open the local Google sign-in callback. Try again.'
        )
      )
    );
    server.listen(0, '127.0.0.1', () => {
      if (settled) {
        server.close();
        return;
      }
      const address = server.address();
      if (!address || typeof address === 'string') {
        finish(
          new GoogleAuthError(
            'The local Google sign-in callback is unavailable.'
          )
        );
        return;
      }
      redirectUri = `http://127.0.0.1:${address.port}/oauth2/callback`;
      openBrowser({ redirectUri, state, challenge }).catch(() =>
        finish(
          new GoogleAuthError(
            'Could not open your browser. Check your default browser and connect again.'
          )
        )
      );
    });
  });
}
