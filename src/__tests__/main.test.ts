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
  session: {
    defaultSession: {
      webRequest: { onHeadersReceived: jest.fn() },
    },
  },
}));
jest.mock('electron-updater', () => ({
  autoUpdater: { checkForUpdatesAndNotify: jest.fn() },
}));
jest.mock('electron-store', () => jest.fn());
jest.mock('electron-is-dev', () => false);
jest.mock('youtube-dl-exec', () => jest.fn());
jest.mock('@getstation/electron-google-oauth2', () => jest.fn());
jest.mock('googleapis', () => ({
  google: { youtube: jest.fn(() => ({})) },
}));
jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('../main/menu', () => jest.fn(() => ({ buildMenu: jest.fn() })));

const { app, BrowserWindow } = jest.requireMock('electron');
const { autoUpdater } = jest.requireMock('electron-updater');

describe('main process startup', () => {
  beforeAll(async () => {
    await import('../main/main');
    await Promise.resolve();
  });

  beforeEach(() => {
    const window = BrowserWindow.mock.results[0].value;
    window.webContents.send.mockClear();
    window.webContents.executeJavaScript.mockClear();
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
});
