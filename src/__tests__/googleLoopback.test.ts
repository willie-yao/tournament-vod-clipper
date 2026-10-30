/** @jest-environment node */
import { createHash } from 'crypto';
import { get, request } from 'http';
import googleLoopback from '../main/googleLoopback';

function visit(url: string, method = 'GET', host?: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      { method, headers: host ? { Host: host } : {} },
      (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode!));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function closed(url: string) {
  return new Promise((resolve, reject) => {
    get(url, () => reject(new Error('Callback listener is still open.'))).on(
      'error',
      resolve
    );
  });
}

it('uses fresh S256 PKCE/state and closes an ephemeral loopback listener after success', async () => {
  const attempt = async () => {
    let callback = '';
    let challenge = '';
    let state = '';
    const result = await googleLoopback(async (authorization) => {
      ({ redirectUri: callback, challenge, state } = authorization);
      expect(new URL(callback).hostname).toBe('127.0.0.1');
      expect(Number(new URL(callback).port)).toBeGreaterThan(0);
      await visit(`${callback}?code=code-fixture&state=${state}`);
    }, new AbortController().signal);
    expect(result.code).toBe('code-fixture');
    expect(result.redirectUri).toBe(callback);
    expect(challenge).toBe(
      createHash('sha256').update(result.verifier).digest('base64url')
    );
    expect(result.verifier).toMatch(/^[a-zA-Z0-9_-]{43}$/);
    await closed(callback);
    return { state, verifier: result.verifier };
  };
  const attempts = await Promise.all([attempt(), attempt()]);
  expect(attempts[0].state).not.toBe(attempts[1].state);
  expect(attempts[0].verifier).not.toBe(attempts[1].verifier);
});

it('accepts only GET on the exact callback path and loopback Host', async () => {
  const result = await googleLoopback(async ({ redirectUri, state }) => {
    expect(await visit(`${redirectUri}/other?code=wrong&state=${state}`)).toBe(
      404
    );
    expect(
      await visit(`${redirectUri}?code=wrong&state=${state}`, 'POST')
    ).toBe(404);
    expect(
      await visit(
        `${redirectUri}?code=wrong&state=${state}`,
        'GET',
        'other-host'
      )
    ).toBe(404);
    await visit(`${redirectUri}?code=expected&state=${state}`);
  }, new AbortController().signal);
  expect(result.code).toBe('expected');
});

it.each([
  'code=fixture&state=wrong',
  'code=fixture',
  'code=one&code=two&state=STATE',
  'code=fixture&state=STATE&state=STATE',
  'state=STATE',
  'error=access_denied&code=fixture&state=STATE',
  'error=one&error=two&state=STATE',
])(
  'rejects invalid authorization responses and closes the listener: %s',
  async (query) => {
    let callback = '';
    await expect(
      googleLoopback(async ({ redirectUri, state }) => {
        callback = redirectUri;
        await visit(`${redirectUri}?${query.replace(/STATE/g, state)}`);
      }, new AbortController().signal)
    ).rejects.toThrow('invalid response');
    await closed(callback);
  }
);

it('reports consent denial without leaking response text and cleans up', async () => {
  let callback = '';
  const pending = googleLoopback(async ({ redirectUri, state }) => {
    callback = redirectUri;
    await visit(
      `${redirectUri}?error=access_denied&error_description=private-fixture&state=${state}`
    );
  }, new AbortController().signal);
  await expect(pending).rejects.toThrow('not approved');
  await expect(pending).rejects.not.toThrow('private-fixture');
  await closed(callback);
});

it.each(['cancel', 'timeout', 'browser failure'] as const)(
  'cleans up after %s',
  async (mode) => {
    let callback = '';
    const controller = new AbortController();
    const pending = googleLoopback(
      async ({ redirectUri }) => {
        callback = redirectUri;
        if (mode === 'cancel') controller.abort();
        if (mode === 'browser failure')
          throw new Error('private-browser-fixture');
      },
      controller.signal,
      mode === 'timeout' ? 40 : 1000
    );
    const messages = {
      cancel: 'canceled',
      timeout: 'timed out',
      'browser failure': 'default browser',
    };
    await expect(pending).rejects.toThrow(messages[mode]);
    await closed(callback);
  }
);

it('does not open a browser for an already canceled attempt', async () => {
  const controller = new AbortController();
  controller.abort();
  const open = jest.fn();
  await expect(googleLoopback(open, controller.signal)).rejects.toThrow(
    'canceled'
  );
  expect(open).not.toHaveBeenCalled();
});
