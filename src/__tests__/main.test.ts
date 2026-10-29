import { build } from '../../package.json';

jest.mock('electron', () => ({
  app: {
    requestSingleInstanceLock: jest.fn(() => true),
    on: jest.fn(),
    whenReady: jest.fn(() => Promise.resolve()),
    setAsDefaultProtocolClient: jest.fn(),
    isPackaged: false,
  },
  BrowserWindow: jest.fn(() => ({
    loadURL: jest.fn(),
    on: jest.fn(),
    isMinimized: jest.fn(() => false),
    restore: jest.fn(),
    focus: jest.fn(),
    webContents: {
      send: jest.fn(),
      executeJavaScript: jest.fn(),
      setWindowOpenHandler: jest.fn(),
    },
  })),
  ipcMain: { handle: jest.fn(), on: jest.fn() },
  safeStorage: {
    isEncryptionAvailable: jest.fn(() => true),
    encryptString: jest.fn((value: string) =>
      Buffer.from(`encrypted:${value}`)
    ),
    decryptString: jest.fn((value: Buffer) =>
      value.toString().replace(/^encrypted:/, '')
    ),
  },
  session: {
    defaultSession: {
      webRequest: { onHeadersReceived: jest.fn() },
    },
  },
}));
jest.mock('electron-updater', () => ({
  autoUpdater: { checkForUpdatesAndNotify: jest.fn() },
}));
jest.mock('electron-store', () =>
  jest.fn(() => ({ get: jest.fn(), set: jest.fn(), delete: jest.fn() }))
);
jest.mock('electron-is-dev', () => false);
jest.mock('youtube-dl-exec', () => jest.fn());
jest.mock('@getstation/electron-google-oauth2', () => jest.fn());
jest.mock('googleapis', () => ({
  google: { youtube: jest.fn(() => ({})) },
}));
jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../main/menu', () => jest.fn(() => ({ buildMenu: jest.fn() })));

const { app, BrowserWindow, ipcMain, safeStorage } =
  jest.requireMock('electron');
const { autoUpdater } = jest.requireMock('electron-updater');
const Store = jest.requireMock('electron-store');
const youtubeDl = jest.requireMock('youtube-dl-exec');
const settings = new Map<string, unknown>();

function handler(channel: string) {
  return ipcMain.handle.mock.calls.find(
    ([name]: [string]) => name === channel
  )[1];
}

describe('main process startup', () => {
  beforeAll(async () => {
    await import('../main/main');
    await Promise.resolve();
  });

  beforeEach(() => {
    const window = BrowserWindow.mock.results[0].value;
    window.webContents.send.mockClear();
    window.webContents.executeJavaScript.mockClear();
    settings.clear();
    const store = Store.mock.results[0].value;
    store.get.mockImplementation((key: string) => settings.get(key));
    store.set.mockImplementation((key: string, value: unknown) =>
      settings.set(key, JSON.parse(JSON.stringify(value)))
    );
    store.delete.mockImplementation((key: string) => settings.delete(key));
    safeStorage.isEncryptionAvailable.mockReturnValue(true);
    youtubeDl.mockReset();
  });

  it('does not check for updates and disables publish metadata', () => {
    expect(BrowserWindow).toHaveBeenCalledTimes(1);
    expect(autoUpdater.checkForUpdatesAndNotify).not.toHaveBeenCalled();
    expect(build.publish).toBeNull();
  });

  it.each([
    'tournamentvodclipper://?value=");globalThis.injected=true;//',
    'tournamentvodclipper://?value=\\backslash',
    'tournamentvodclipper://?value=line\nbreak',
  ])('forwards callback text only as IPC data: %s', (url) => {
    const window = BrowserWindow.mock.results[0].value;
    const onOpenUrl = app.on.mock.calls.find(
      ([name]: [string]) => name === 'open-url'
    )[1];
    const event = { preventDefault: jest.fn() };

    onOpenUrl(event, url);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(window.webContents.send).toHaveBeenCalledWith('login-success', {
      deeplinkingUrl: url,
    });
    expect(window.webContents.executeJavaScript).not.toHaveBeenCalled();
  });

  it('rejects callbacks outside the expected root', () => {
    const window = BrowserWindow.mock.results[0].value;
    const onOpenUrl = app.on.mock.calls.find(
      ([name]: [string]) => name === 'open-url'
    )[1];
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});

    onOpenUrl({ preventDefault: jest.fn() }, 'https://example.com/');

    expect(window.webContents.send).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledWith(
      'Ignoring unexpected login callback URL'
    );
    warning.mockRestore();
  });

  it('accepts only expected callbacks in second-instance arguments', () => {
    const window = BrowserWindow.mock.results[0].value;
    const onSecondInstance = app.on.mock.calls.find(
      ([name]: [string]) => name === 'second-instance'
    )[1];
    const url = 'tournamentvodclipper://?value="\\\n';

    onSecondInstance({}, ['clipper.exe', 'https://example.com/', url]);

    expect(window.webContents.send).toHaveBeenCalledWith('login-success', {
      deeplinkingUrl: url,
    });
    expect(window.webContents.executeJavaScript).not.toHaveBeenCalled();
    expect(window.focus).toHaveBeenCalled();
  });

  it('does not register the sample startup reset', () => {
    expect(
      ipcMain.on.mock.calls.some(([name]: [string]) => name === 'ipc-example')
    ).toBe(false);
  });

  it('saves encrypted settings and reads their serialized form without changing search values', async () => {
    settings.set('eventId', 'saved-event');
    settings.set('station', 'saved-station');
    settings.set('vodUrl', 'saved-vod');
    await handler('electron-store-set-secret')({}, 'apikey', 'test-key');
    expect(settings.get('apikey')).toEqual({
      type: 'Buffer',
      data: [...Buffer.from('encrypted:test-key')],
    });
    expect(await handler('electron-store-get-secret')({}, 'apikey')).toBe(
      'test-key'
    );
    expect(await handler('electron-store-get-secret')({}, 'apikey')).toBe(
      'test-key'
    );
    expect(settings.get('eventId')).toBe('saved-event');
    expect(settings.get('station')).toBe('saved-station');
    expect(settings.get('vodUrl')).toBe('saved-vod');
  });

  it('migrates an existing plaintext key instead of overwriting it from the environment', async () => {
    settings.set('apikey', 'legacy-test-key');
    expect(await handler('electron-store-get-secret')({}, 'apikey')).toBe(
      'legacy-test-key'
    );
    expect(settings.get('apikey')).not.toBe('legacy-test-key');
    expect(await handler('electron-store-get-secret')({}, 'apikey')).toBe(
      'legacy-test-key'
    );
  });

  it('handles missing settings and rejects unavailable encryption without losing a saved value', async () => {
    expect(await handler('electron-store-get-secret')({}, 'apikey')).toBe('');
    settings.set('apikey', 'legacy-test-key');
    safeStorage.isEncryptionAvailable.mockReturnValue(false);
    await expect(
      handler('electron-store-get-secret')({}, 'apikey')
    ).rejects.toThrow('Secure storage is unavailable');
    await expect(
      handler('electron-store-set-secret')({}, 'apikey', 'replacement')
    ).rejects.toThrow('Secure storage is unavailable');
    expect(settings.get('apikey')).toBe('legacy-test-key');
  });

  it('reports malformed saved encrypted data', async () => {
    settings.set('apikey', { type: 'Buffer', data: ['invalid'] });
    await expect(
      handler('electron-store-get-secret')({}, 'apikey')
    ).rejects.toThrow('saved API key is invalid');
  });

  it('propagates metadata errors and returns a finite VOD timestamp', async () => {
    youtubeDl.mockRejectedValueOnce(new Error('test metadata failure'));
    await expect(
      handler('retrieve-video-information')({}, { vodUrl: 'test-url' })
    ).rejects.toThrow('test metadata failure');
    youtubeDl.mockResolvedValueOnce({ timestamp: 1000 });
    expect(
      await handler('retrieve-video-information')({}, { vodUrl: 'test-url' })
    ).toBe(1000);
  });

  it.each([null, undefined, NaN, Infinity])(
    'rejects invalid VOD timestamp %s',
    async (timestamp) => {
      youtubeDl.mockResolvedValueOnce({ timestamp });
      await expect(
        handler('retrieve-video-information')({}, { vodUrl: 'test-url' })
      ).rejects.toThrow('VOD start timestamp');
    }
  );

  it.each<[unknown, unknown]>([
    [null, 60],
    [0, null],
    [NaN, 60],
    [0, Infinity],
    [-60, 60],
    [60, 0],
    [60, 60],
  ])(
    'rejects invalid download boundaries %s, %s before starting yt-dlp',
    async (startTime, endTime) => {
      await expect(
        handler('download-video')({}, { startTime, endTime })
      ).rejects.toThrow();
      expect(youtubeDl).not.toHaveBeenCalled();
    }
  );

  it('passes 25-hour boundaries to yt-dlp as elapsed seconds', async () => {
    youtubeDl.mockResolvedValueOnce({});
    await handler('download-video')(
      {},
      {
        vodUrl: 'test-url',
        title: 'test-title',
        tournamentName: 'test-tournament',
        startTime: 90000,
        endTime: 90060,
      }
    );
    expect(youtubeDl).toHaveBeenCalledWith(
      'test-url',
      expect.objectContaining({ downloadSections: '*90000-90060' })
    );
  });
});
