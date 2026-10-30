import path from 'path';
import { build, dependencies } from '../../package.json';

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/mock/appdata'),
    getAppPath: jest.fn(() => '/mock/app'),
    setPath: jest.fn(),
    commandLine: { getSwitchValue: jest.fn(() => '') },
    requestSingleInstanceLock: jest.fn(() => true),
    on: jest.fn(),
    whenReady: jest.fn(() => Promise.resolve()),
    setAsDefaultProtocolClient: jest.fn(),
    isPackaged: false,
  },
  BrowserWindow: jest.fn(() => {
    const listeners = new Map<string, () => void>();
    return {
      loadURL: jest.fn(async () => {
        listeners.get('ready-to-show')?.();
      }),
      on: jest.fn((name: string, callback: () => void) => {
        listeners.set(name, callback);
      }),
      show: jest.fn(),
      minimize: jest.fn(),
      isMinimized: jest.fn(() => false),
      restore: jest.fn(),
      focus: jest.fn(),
      webContents: {
        send: jest.fn(),
        executeJavaScript: jest.fn(),
        setWindowOpenHandler: jest.fn(),
        on: jest.fn(),
      },
    };
  }),
  ipcMain: { handle: jest.fn(), on: jest.fn() },
  shell: { openPath: jest.fn().mockResolvedValue('') },
  dialog: { showOpenDialog: jest.fn() },
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
jest.mock('electron-store', () =>
  jest.fn(() => ({ get: jest.fn(), set: jest.fn(), delete: jest.fn() }))
);
jest.mock('electron-is-dev', () => false);
jest.mock('../main/nativeTools', () => ({ runYtDlp: jest.fn() }));
jest.mock('../main/rendererHost', () => ({
  startRendererHost: jest.fn().mockResolvedValue({
    url: 'http://localhost:12345/index.html',
    server: { close: jest.fn() },
  }),
}));
jest.mock('../main/youtubeAuth', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    status: jest.fn(() => ({
      state: 'disconnected',
      message: 'Connect YouTube.',
    })),
    connect: jest.fn(),
    disconnect: jest.fn(),
    stop: jest.fn(),
    request: jest.fn(),
  })),
}));
jest.mock('@googleapis/youtube', () => ({
  youtube: jest.fn(() => ({
    videos: { insert: jest.fn() },
    playlists: { insert: jest.fn() },
    thumbnails: { set: jest.fn() },
    playlistItems: { insert: jest.fn() },
  })),
}));
jest.mock('fs', () => ({
  createReadStream: jest.fn(() => ({})),
  existsSync: jest.fn(() => false),
}));
jest.mock('../main/outputFiles', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    root: jest.fn().mockResolvedValue('/mock/output'),
    target: jest.fn().mockResolvedValue({
      folderName: 'test-tournament',
      videoName: 'test-title.mp4',
      path: '/mock/video.mp4',
    }),
    video: jest.fn().mockResolvedValue('/mock/video.mp4'),
    saveThumbnail: jest.fn().mockResolvedValue(undefined),
    thumbnail: jest.fn().mockResolvedValue(null),
    folders: jest.fn().mockResolvedValue(['Tournament']),
    videos: jest.fn().mockResolvedValue(['clip.mp4']),
    tournament: jest.fn().mockResolvedValue('/mock/output/Tournament'),
  })),
}));
jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../main/menu', () => jest.fn(() => ({ buildMenu: jest.fn() })));

const { app, BrowserWindow, ipcMain, safeStorage, shell, dialog } =
  jest.requireMock('electron');
const Store = jest.requireMock('electron-store');
const youtubeDl = jest.requireMock('../main/nativeTools').runYtDlp;
const OutputFiles = jest.requireMock('../main/outputFiles').default;
const google = jest.requireMock('@googleapis/youtube');
const YouTubeAuth = jest.requireMock('../main/youtubeAuth').default;
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
    shell.openPath.mockResolvedValue('');
    const youtube = google.youtube.mock.results[0].value;
    [
      youtube.videos.insert,
      youtube.playlists.insert,
      youtube.thumbnails.set,
      youtube.playlistItems.insert,
    ].forEach((request) =>
      request.mockReset().mockResolvedValue({ data: { id: 'confirmed' } })
    );
    const outputs = OutputFiles.mock.results[0].value;
    outputs.thumbnail.mockReset().mockResolvedValue(null);
    outputs.saveThumbnail.mockReset().mockResolvedValue(undefined);
    YouTubeAuth.mock.results[0].value.request
      .mockReset()
      .mockImplementation(
        async (
          _args: unknown,
          _action: string,
          request: (headers: object) => Promise<{ data: unknown }>
        ) => (await request({ Authorization: 'Bearer main-only-fixture' })).data
      );
  });

  it('does not check for updates and disables publish metadata', () => {
    expect(BrowserWindow).toHaveBeenCalledTimes(1);
    expect(dependencies).not.toHaveProperty('electron-updater');
    expect(build.publish).toBeNull();
    expect(app.setAsDefaultProtocolClient).not.toHaveBeenCalled();
  });

  it('shows the window when ready-to-show arrives before loadURL resolves', () => {
    const window = BrowserWindow.mock.results[0].value;
    expect(window.loadURL).toHaveBeenCalledWith(
      'http://localhost:12345/index.html'
    );
    expect(window.show).toHaveBeenCalledTimes(1);
  });

  it('ignores legacy deep links and only focuses a second instance', () => {
    const window = BrowserWindow.mock.results[0].value;
    const onSecondInstance = app.on.mock.calls.find(
      ([name]: [string]) => name === 'second-instance'
    )[1];
    const url = 'tournamentvodclipper://?value="\\\n';

    onSecondInstance({}, ['clipper.exe', 'https://example.com/', url]);

    expect(window.webContents.send).not.toHaveBeenCalled();
    expect(window.webContents.executeJavaScript).not.toHaveBeenCalled();
    expect(window.focus).toHaveBeenCalled();
    expect(
      app.on.mock.calls.some(([name]: [string]) => name === 'open-url')
    ).toBe(false);
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
      expect.objectContaining({ downloadSections: '*90000-90060' }),
      expect.any(Object)
    );
  });

  it('keeps the legacy root until the user explicitly chooses another directory', async () => {
    expect(await handler('get-output-directory')()).toBe(
      path.resolve(process.cwd(), 'downloadedVODs')
    );
    dialog.showOpenDialog.mockResolvedValueOnce({
      canceled: true,
      filePaths: [],
    });
    expect(await handler('choose-output-directory')()).toBeNull();
    expect(settings.has('outputDirectory')).toBe(false);
    dialog.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: ['/mock/selected'],
    });
    expect(await handler('choose-output-directory')()).toBe('/mock/output');
    expect(settings.get('outputDirectory')).toBe('/mock/output');
  });

  it('awaits thumbnail writes and reports folder-open failures', async () => {
    const outputs = OutputFiles.mock.results[0].value;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    outputs.saveThumbnail.mockReturnValueOnce(gate);
    let settled = false;
    const pending = handler('save-thumbnail')(
      {},
      {
        folderName: 'Tournament',
        videoName: 'clip.mp4',
        buf: Buffer.from('image'),
      }
    ).then(() => {
      settled = true;
      return undefined;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    release();
    await pending;
    expect(settled).toBe(true);
    outputs.saveThumbnail.mockRejectedValueOnce(new Error('test write failed'));
    await expect(handler('save-thumbnail')({}, {})).rejects.toThrow(
      'test write failed'
    );
    shell.openPath.mockResolvedValueOnce('test open failed');
    await expect(handler('open-folder')({}, 'Tournament')).rejects.toThrow(
      'test open failed'
    );
  });

  it.each([
    'create-playlist',
    'upload-single-video',
    'upload-thumbnail',
    'add-video-to-playlist',
  ])(
    'routes %s through main-owned auth without renderer token parameters or automatic retries',
    async (channel) => {
      const youtube = google.youtube.mock.results[0].value;
      const outputs = OutputFiles.mock.results[0].value;
      outputs.thumbnail.mockResolvedValue('/mock/thumbnail.jpg');
      [
        youtube.playlists.insert,
        youtube.videos.insert,
        youtube.thumbnails.set,
        youtube.playlistItems.insert,
      ].forEach((request) =>
        request.mockResolvedValue({ data: { id: 'confirmed' } })
      );
      const args = {
        folderName: 'Tournament',
        videoName: 'clip.mp4',
        title: 'Valid title',
        sessionId: 'session-fixture',
        channelId: 'channel-fixture',
        accessToken: 'renderer-token-must-be-ignored',
        visibility: 'private',
      };
      await handler(channel)({}, args);
      expect(YouTubeAuth.mock.results[0].value.request).toHaveBeenCalledWith(
        args,
        expect.any(String),
        expect.any(Function)
      );
      const request = [
        youtube.playlists.insert,
        youtube.videos.insert,
        youtube.thumbnails.set,
        youtube.playlistItems.insert,
      ].find((mock) => mock.mock.calls.length)!;
      expect(request.mock.calls[0][0]).not.toHaveProperty('access_token');
      expect(request.mock.calls[0][1]).toEqual({
        headers: { Authorization: 'Bearer main-only-fixture' },
        retry: false,
      });
    }
  );

  it('rejects invalid titles and absent resource IDs before claiming success', async () => {
    await expect(
      handler('upload-single-video')({}, { title: 'x'.repeat(101) })
    ).rejects.toThrow('1 to 100');
    const youtube = google.youtube.mock.results[0].value;
    expect(youtube.videos.insert).not.toHaveBeenCalled();
    youtube.videos.insert.mockResolvedValueOnce({ data: {} });
    await expect(
      handler('upload-single-video')(
        {},
        { folderName: 'Tournament', videoName: 'clip.mp4', title: 'valid' }
      )
    ).rejects.toThrow('did not confirm');
    expect(
      await handler('upload-thumbnail')(
        {},
        { folderName: 'Tournament', videoName: 'clip.mp4' }
      )
    ).toEqual({ status: 'skipped' });
  });

  it('does not expose main-only settings through any generic store API', async () => {
    settings.set('youtubeCredentials', 'encrypted-fixture');
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    for (const key of [
      'youtubeCredentials',
      undefined,
      'youtubeCredentials.refreshToken',
    ]) {
      for (const channel of [
        'electron-store-get',
        'electron-store-set',
        'electron-store-delete',
      ]) {
        const listener = ipcMain.on.mock.calls.find(
          ([name]: [string]) => name === channel
        )[1];
        const event = { returnValue: undefined };
        await listener(event, key, 'replacement');
        expect(event.returnValue).toBeUndefined();
      }
    }
    expect(settings.get('youtubeCredentials')).toBe('encrypted-fixture');
    await expect(
      handler('electron-store-get-secret')({}, 'youtubeCredentials')
    ).rejects.toThrow('Invalid secret');
    await expect(
      handler('electron-store-set-secret')(
        {},
        'youtubeCredentials',
        'replacement'
      )
    ).rejects.toThrow('Invalid secret');
    warning.mockRestore();
  });

  it('wires safe status, connect, disconnect and quit cleanup', async () => {
    const auth = YouTubeAuth.mock.results[0].value;
    expect(await handler('get-youtube-status')()).toEqual({
      state: 'disconnected',
      message: 'Connect YouTube.',
    });
    await handler('connect-youtube')();
    await handler('disconnect-youtube')();
    expect(auth.connect).toHaveBeenCalledTimes(1);
    expect(auth.disconnect).toHaveBeenCalledTimes(1);
    app.on.mock.calls.find(([name]: [string]) => name === 'before-quit')[1]();
    expect(auth.stop).toHaveBeenCalledTimes(1);
    expect(
      ipcMain.handle.mock.calls.some(
        ([name]: [string]) => name === 'open-google-login'
      )
    ).toBe(false);
  });
});
