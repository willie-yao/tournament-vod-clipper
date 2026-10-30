/** @jest-environment node */
import { createServer, get, Server } from 'http';
import { ClientAuthentication, OAuth2Client } from 'google-auth-library';
import YouTubeAuth, {
  YOUTUBE_CREDENTIALS_KEY,
  YOUTUBE_SCOPE,
} from '../main/youtubeAuth';
import type { YouTubeStatus } from '../common/youtube';

const clientId = 'desktop-fixture.apps.googleusercontent.com';
const channel = { id: 'channel-fixture', title: 'Fixture tournament channel' };
const tokens = {
  access_token: 'access-fixture',
  refresh_token: 'refresh-fixture',
  expires_in: 3600,
  scope: YOUTUBE_SCOPE,
};
let tokenServer: Server;
let tokenUrl: URL;
let tokenStatus = 200;
let tokenResponse: object = tokens;
let tokenRequests: URLSearchParams[] = [];

beforeAll(async () => {
  tokenServer = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      tokenRequests.push(new URLSearchParams(body));
      res.writeHead(tokenStatus, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(tokenResponse));
    });
  });
  await new Promise<void>((resolve) =>
    tokenServer.listen(0, '127.0.0.1', resolve)
  );
  const address = tokenServer.address();
  if (!address || typeof address === 'string')
    throw new Error('No fixture token listener.');
  tokenUrl = new URL(`http://127.0.0.1:${address.port}/token`);
});

afterAll(async () => {
  tokenServer.closeAllConnections();
  await new Promise<void>((resolve) => tokenServer.close(() => resolve()));
});

beforeEach(() => {
  tokenStatus = 200;
  tokenResponse = tokens;
  tokenRequests = [];
});

function visit(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    get(url, (response) => {
      response.resume();
      response.on('end', resolve);
    }).on('error', reject);
  });
}

function fixture() {
  const settings = new Map<string, string>();
  const ciphertext = new Map<string, string>();
  const clients: OAuth2Client[] = [];
  const options = {
    clientId,
    store: {
      get: jest.fn((key: string) => settings.get(key)),
      set: jest.fn((key: string, value: string) => {
        settings.set(key, value);
      }),
      delete: jest.fn((key: string) => {
        settings.delete(key);
      }),
    },
    encryption: {
      isEncryptionAvailable: jest.fn(() => true),
      getSelectedStorageBackend: jest.fn(() => 'keychain'),
      encryptString: jest.fn((value: string) => {
        const key = `opaque-ciphertext-${ciphertext.size}`;
        ciphertext.set(key, value);
        return Buffer.from(key);
      }),
      decryptString: jest.fn((value: Buffer) => {
        const plaintext = ciphertext.get(value.toString());
        if (!plaintext) throw new Error('Fixture decryption failed.');
        return plaintext;
      }),
    },
    openBrowser: jest.fn(async (value: string) => {
      const url = new URL(value);
      await visit(
        `${url.searchParams.get('redirect_uri')}?state=${url.searchParams.get(
          'state'
        )}&code=authorization-fixture`
      );
    }),
    identify: jest.fn(async () => channel),
    onStatus: jest.fn<void, [YouTubeStatus]>(),
    createClient: (signal: AbortSignal) => {
      const client = new OAuth2Client({
        clientId,
        clientAuthentication: ClientAuthentication.None,
        endpoints: { oauth2TokenUrl: tokenUrl },
        transporterOptions: {
          timeout: 1000,
          signal,
          retryConfig: { retry: 0 },
        },
      });
      clients.push(client);
      return client;
    },
  };
  const auth = new YouTubeAuth(options);
  return { auth, options, settings, clients };
}

function session(status: YouTubeStatus) {
  if (status.state !== 'connected')
    throw new Error('Fixture is not connected.');
  return { sessionId: status.sessionId, channelId: status.channel.id };
}

it('builds a public-client authorization URL and exchanges the PKCE verifier without a secret', async () => {
  const { auth, options, settings } = fixture();
  const status = await auth.connect();
  const url = new URL(options.openBrowser.mock.calls[0][0]);
  expect(url.origin).toBe('https://accounts.google.com');
  expect(url.searchParams.get('client_id')).toBe(clientId);
  expect(url.searchParams.get('response_type')).toBe('code');
  expect(url.searchParams.get('access_type')).toBe('offline');
  expect(url.searchParams.get('scope')).toBe(YOUTUBE_SCOPE);
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  expect(url.searchParams.get('state')).toHaveLength(43);
  expect(tokenRequests[0].get('code_verifier')).toHaveLength(43);
  expect(tokenRequests[0].get('redirect_uri')).toBe(
    url.searchParams.get('redirect_uri')
  );
  expect(tokenRequests[0].has('client_secret')).toBe(false);
  expect(status).toEqual(
    expect.objectContaining({ state: 'connected', channel })
  );
  expect(JSON.stringify(status)).not.toMatch(
    /access-fixture|refresh-fixture|access_token|refresh_token/
  );
  expect(JSON.stringify(options.onStatus.mock.calls)).not.toMatch(
    /access-fixture|refresh-fixture/
  );
  expect(options.encryption.encryptString).toHaveBeenCalledTimes(1);
  expect(JSON.stringify([...settings])).not.toContain('refresh-fixture');
  expect(options.encryption.encryptString.mock.calls[0][0]).not.toContain(
    'access-fixture'
  );
});

it('recovers encrypted refresh credentials after restart and refreshes without changing channels', async () => {
  const { auth, options, settings } = fixture();
  const original = session(await auth.connect());
  auth.stop();
  const restarted = new YouTubeAuth(options);
  const restored = session(restarted.status());
  expect(restored.channelId).toBe(original.channelId);
  expect(restored.sessionId).not.toBe(original.sessionId);
  tokenResponse = {
    access_token: 'refreshed-access-fixture',
    expires_in: 3600,
  };
  const request = jest.fn(async () => ({ data: { id: 'confirmed' } }));
  expect(await restarted.request(restored, 'upload', request)).toEqual({
    id: 'confirmed',
  });
  expect(request).toHaveBeenCalledWith({
    Authorization: 'Bearer refreshed-access-fixture',
  });
  expect(tokenRequests[1].get('grant_type')).toBe('refresh_token');
  expect(tokenRequests[1].get('refresh_token')).toBe('refresh-fixture');
  expect(tokenRequests[1].get('client_secret') || '').toBe('');
  expect(options.encryption.encryptString).toHaveBeenCalledTimes(1);
  expect(settings.has(YOUTUBE_CREDENTIALS_KEY)).toBe(true);
  expect(
    JSON.parse(options.encryption.encryptString.mock.calls[0][0]).refreshToken
  ).toBe('refresh-fixture');
});

it('persists and uses a replacement refresh credential', async () => {
  const { auth, options, clients } = fixture();
  const expected = session(await auth.connect());
  clients[0].credentials.expiry_date = Date.now() - 1000;
  tokenResponse = {
    access_token: 'refreshed-access-fixture',
    refresh_token: 'replacement-refresh-fixture',
    expires_in: 3600,
  };
  await auth.request(expected, 'upload', async () => ({ data: {} }));
  expect(clients[0].credentials.refresh_token).toBe(
    'replacement-refresh-fixture'
  );
  expect(
    JSON.parse(options.encryption.encryptString.mock.calls[1][0]).refreshToken
  ).toBe('replacement-refresh-fixture');
});

it.each(['invalid_grant', 'unauthorized'] as const)(
  'requires reconnect after %s without exposing Google errors',
  async (mode) => {
    const { auth, clients, settings } = fixture();
    const expected = session(await auth.connect());
    clients[0].credentials.expiry_date = Date.now() - 1000;
    tokenStatus = mode === 'invalid_grant' ? 400 : 401;
    tokenResponse = { error: mode, error_description: 'private-error-fixture' };
    const request = jest.fn();
    const pending = auth.request(expected, 'upload', request);
    await expect(pending).rejects.toThrow('Reconnect YouTube');
    await expect(pending).rejects.not.toThrow('private-error-fixture');
    expect(auth.status().state).toBe('reconnect-required');
    expect(settings.has(YOUTUBE_CREDENTIALS_KEY)).toBe(false);
    expect(request).not.toHaveBeenCalled();
  }
);

it('disconnects locally without calling Google revocation and prevents restart recovery', async () => {
  const { auth, options, settings, clients } = fixture();
  const expected = session(await auth.connect());
  const revoke = jest.spyOn(clients[0], 'revokeCredentials');
  expect(auth.disconnect().state).toBe('disconnected');
  expect(settings.has(YOUTUBE_CREDENTIALS_KEY)).toBe(false);
  expect(revoke).not.toHaveBeenCalled();
  expect(new YouTubeAuth(options).status().state).toBe('disconnected');
  const request = jest.fn();
  await expect(auth.request(expected, 'upload', request)).rejects.toThrow(
    'connection changed'
  );
  expect(request).not.toHaveBeenCalled();
});

it('does not restore a connection after disconnect during a pending identity lookup', async () => {
  const { auth, options, settings } = fixture();
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  options.identify.mockImplementationOnce(async () => {
    entered();
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    return channel;
  });
  const pending = auth.connect().catch((error: Error) => error);
  await started;
  auth.disconnect();
  release();
  await expect(pending).resolves.toBeInstanceOf(Error);
  await expect(pending).resolves.toHaveProperty(
    'message',
    expect.stringContaining('canceled')
  );
  expect(auth.status().state).toBe('disconnected');
  expect(settings.size).toBe(0);
});

it.each(['disconnect', 'replace'] as const)(
  'does not let a stale refresh restore or authorize after %s',
  async (mode) => {
    const { auth, clients, settings } = fixture();
    const expected = session(await auth.connect());
    let release!: () => void;
    jest
      .spyOn(clients[0], 'getAccessToken')
      .mockImplementationOnce(async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        clients[0].emit('tokens', { refresh_token: 'late-refresh-fixture' });
        return { token: 'late-access-fixture' };
      });
    const request = jest.fn();
    const pending = auth.request(expected, 'upload', request);
    auth.disconnect();
    if (mode === 'replace') await auth.connect();
    const saved = settings.get(YOUTUBE_CREDENTIALS_KEY);
    release();
    await expect(pending).rejects.toThrow('connection changed');
    expect(settings.get(YOUTUBE_CREDENTIALS_KEY)).toBe(saved);
    expect(auth.status().state).toBe(
      mode === 'replace' ? 'connected' : 'disconnected'
    );
    expect(request).not.toHaveBeenCalled();
  }
);

it('rejects stale/replaced session and channel identifiers before sending mutations', async () => {
  const { auth } = fixture();
  const old = session(await auth.connect());
  const current = session(await auth.connect());
  const request = jest.fn();
  await expect(auth.request(old, 'upload', request)).rejects.toThrow(
    'connection changed'
  );
  await expect(
    auth.request({ ...current, channelId: 'other' }, 'upload', request)
  ).rejects.toThrow('connection changed');
  expect(request).not.toHaveBeenCalled();
});

it.each([
  'unavailable',
  'plaintext backend',
  'encryption failure',
  'save failure',
] as const)(
  'rejects %s without saving plaintext or claiming success',
  async (failure) => {
    const { auth, options, settings } = fixture();
    if (failure === 'unavailable')
      options.encryption.isEncryptionAvailable.mockReturnValue(false);
    if (failure === 'plaintext backend')
      options.encryption.getSelectedStorageBackend.mockReturnValue(
        'basic_text'
      );
    if (failure === 'encryption failure')
      options.encryption.encryptString.mockImplementation(() => {
        throw new Error('private-fixture');
      });
    if (failure === 'save failure')
      options.store.set.mockImplementation(() => {
        throw new Error('private-fixture');
      });
    await expect(auth.connect()).rejects.toThrow('secure storage');
    expect(auth.status().state).toBe('storage-error');
    expect(settings.size).toBe(0);
  }
);

it('reports locked, unreadable and mismatched saved connections instead of silently falling back', async () => {
  const { auth, options, settings } = fixture();
  await auth.connect();
  options.encryption.isEncryptionAvailable.mockReturnValue(false);
  expect(new YouTubeAuth(options).status().state).toBe('storage-error');
  options.encryption.isEncryptionAvailable.mockReturnValue(true);
  options.encryption.decryptString.mockImplementationOnce(() => {
    throw new Error('private-fixture');
  });
  expect(new YouTubeAuth(options).status().state).toBe('storage-error');
  expect(
    new YouTubeAuth({ ...options, clientId: 'different-client' }).status().state
  ).toBe('reconnect-required');
  settings.set(YOUTUBE_CREDENTIALS_KEY, 'plaintext-fixture');
  expect(new YouTubeAuth(options).status().state).toBe('storage-error');
});

it('requires a maintainer client ID without opening a browser or writing credentials', async () => {
  const { options } = fixture();
  const auth = new YouTubeAuth({ ...options, clientId: '' });
  expect(auth.status().state).toBe('not-configured');
  expect((await auth.connect()).state).toBe('not-configured');
  expect(options.openBrowser).not.toHaveBeenCalled();
  expect(options.store.set).not.toHaveBeenCalled();
});

it('cleans up browser sign-in on quit without storing any credentials', async () => {
  const { auth, options, settings } = fixture();
  let entered!: () => void;
  let callback = '';
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  options.openBrowser.mockImplementationOnce(async (value) => {
    callback = new URL(value).searchParams.get('redirect_uri')!;
    entered();
  });
  const pending = auth.connect().catch((error: Error) => error);
  await started;
  auth.stop();
  await expect(pending).resolves.toBeInstanceOf(Error);
  await expect(pending).resolves.toHaveProperty(
    'message',
    expect.stringContaining('canceled')
  );
  await expect(visit(callback)).rejects.toThrow();
  expect(settings.size).toBe(0);
  expect(tokenRequests).toHaveLength(0);
});

it('reports consent denial without exchanging or saving tokens', async () => {
  const { auth, options, settings } = fixture();
  options.openBrowser.mockImplementationOnce(async (value) => {
    const url = new URL(value);
    await visit(
      `${url.searchParams.get('redirect_uri')}?state=${url.searchParams.get(
        'state'
      )}&error=access_denied`
    );
  });
  await expect(auth.connect()).rejects.toThrow('not approved');
  expect(auth.status().state).toBe('disconnected');
  expect(settings.size).toBe(0);
  expect(tokenRequests).toHaveLength(0);
});

it.each([
  { access_token: 'fixture' },
  { refresh_token: 'fixture' },
  { ...tokens, scope: 'https://www.googleapis.com/auth/youtube.upload' },
])(
  'does not claim persistent access when required tokens or scope are missing',
  async (response) => {
    const { auth, settings, options } = fixture();
    tokenResponse = response;
    await expect(auth.connect()).rejects.toThrow('persistent YouTube access');
    expect(settings.size).toBe(0);
    expect(options.identify).not.toHaveBeenCalled();
  }
);

it('reports a missing YouTube channel and a failed local disconnect clearly', async () => {
  const { auth, options } = fixture();
  options.identify.mockResolvedValueOnce({ id: '', title: '' });
  await expect(auth.connect()).rejects.toThrow('No YouTube channel');
  expect(auth.status().state).toBe('disconnected');
  await auth.connect();
  options.store.delete.mockImplementationOnce(() => {
    throw new Error('private-fixture');
  });
  await expect(Promise.resolve().then(() => auth.disconnect())).rejects.toThrow(
    'could not be removed'
  );
  expect(auth.status().state).toBe('storage-error');
});

it('blocks a mutation if replacement refresh credentials cannot be encrypted', async () => {
  const { auth, options, clients } = fixture();
  const expected = session(await auth.connect());
  clients[0].credentials.expiry_date = Date.now() - 1000;
  tokenResponse = { ...tokens, refresh_token: 'replacement-refresh-fixture' };
  options.encryption.isEncryptionAvailable.mockReturnValue(false);
  const request = jest.fn();
  await expect(auth.request(expected, 'upload', request)).rejects.toThrow(
    'secure storage'
  );
  expect(auth.status().state).toBe('storage-error');
  expect(request).not.toHaveBeenCalled();
});

it.each([
  [403, 'YouTube quota'],
  [500, 'connection, account, and the local file'],
])(
  'sanitizes API status %s without replaying mutations',
  async (code, message) => {
    const { auth } = fixture();
    const expected = session(await auth.connect());
    const request = jest
      .fn()
      .mockRejectedValue({ code, message: 'private-token-fixture' });
    const pending = auth.request(expected, 'create playlist', request);
    await expect(pending).rejects.toThrow(String(message));
    await expect(pending).rejects.not.toThrow('private-token-fixture');
    expect(request).toHaveBeenCalledTimes(1);
  }
);
