/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  safeStorage,
  dialog,
} from 'electron';
import MenuBuilder from './menu';
import { legacyProfilePath, resolveHtmlPath, resolvePreloadPath } from './util';
import { getClipRangeError } from '../common/clipTime';
import { getVideoTitleError, VideoUpload } from '../common/files';
import OutputFiles from './outputFiles';
import { runYtDlp } from './nativeTools';
import { startRendererHost } from './rendererHost';
import Store from 'electron-store';
import { youtube as createYoutube } from '@googleapis/youtube';
import YouTubeAuth from './youtubeAuth';
import { PUBLIC_YOUTUBE_CLIENT_ID } from './youtubeClient';
require('dotenv').config();
const fs = require('fs');
const explicitProfile = app.commandLine.getSwitchValue('user-data-dir');
const legacyProfile = explicitProfile
  ? null
  : legacyProfilePath(app.getPath('appData'));
if (explicitProfile) {
  fs.mkdirSync(path.resolve(explicitProfile), { recursive: true, mode: 0o700 });
  app.setPath('userData', path.resolve(explicitProfile));
} else if (legacyProfile) {
  app.setPath('userData', legacyProfile);
}
const store = new Store();
const outputDirectory = () => {
  const saved = store.get('outputDirectory');
  if (saved !== undefined && typeof saved !== 'string') {
    throw new Error('The saved output directory is invalid. Choose it again.');
  }
  return saved || path.resolve(process.cwd(), 'downloadedVODs');
};
const outputFiles = new OutputFiles(outputDirectory);
const isDev = require('electron-is-dev');

// initialize the Youtube API library
const youtube = createYoutube('v3');
const nativeContext = () => ({
  packaged: app.isPackaged,
  built: process.env.NODE_ENV === 'production',
  appPath: app.getAppPath(),
  resourcesPath: process.resourcesPath,
  platform: process.platform,
  arch: process.arch,
});

let mainWindow: BrowserWindow | null = null;
let rendererHost: Awaited<ReturnType<typeof startRendererHost>> | undefined;
const youtubeAuth = new YouTubeAuth({
  clientId: process.env.GOOGLE_DESKTOP_CLIENT_ID ?? PUBLIC_YOUTUBE_CLIENT_ID,
  store,
  encryption: safeStorage,
  openBrowser: (url) => shell.openExternal(url),
  identify: async (accessToken, signal) => {
    const response = await youtube.channels.list(
      { part: ['id', 'snippet'], mine: true },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        retry: false,
        timeout: 30_000,
        signal,
      }
    );
    const channel = response.data.items?.[0];
    return { id: channel?.id || '', title: channel?.snippet?.title || '' };
  },
  onStatus: (status) => mainWindow?.webContents.send('youtube-status', status),
});

// Force Single Instance Application
const gotTheLock = app.requestSingleInstanceLock();
if (gotTheLock) {
  console.log('Got the lock');
  app.on('second-instance', () => {
    // Someone tried to run a second instance, we should focus our window.
    console.log('second instance');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
} else {
  console.log('Did not get the lock');
  app.quit();
}

ipcMain.handle('get-output-directory', () => outputDirectory());
ipcMain.handle('create-folder', () => outputFiles.root(true));
ipcMain.handle('choose-output-directory', async () => {
  if (!mainWindow) throw new Error('The application window is unavailable.');
  const savedDirectory = store.get('outputDirectory');
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose the folder containing your tournament VOD folders',
    defaultPath:
      typeof savedDirectory === 'string'
        ? savedDirectory
        : path.resolve(process.cwd(), 'downloadedVODs'),
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const selected = result.filePaths[0];
  const files = new OutputFiles(() => selected);
  const root = await files.root(true);
  store.set('outputDirectory', root);
  return root;
});

ipcMain.handle('open-folder', async (event, folderName: string) => {
  const folder = await outputFiles.tournament(folderName);
  const error = await shell.openPath(folder);
  if (error) throw new Error(`Could not open the output folder: ${error}`);
});

ipcMain.handle('retrieve-video-information', async (event, arg) => {
  const output = await runYtDlp(
    arg.vodUrl,
    {
      dumpSingleJson: true,
      skipDownload: true,
    },
    nativeContext()
  );
  const timestamp: unknown =
    output && typeof output === 'object'
      ? Object.getOwnPropertyDescriptor(output, 'timestamp')?.value
      : undefined;
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    throw new Error(
      'The VOD start timestamp is unavailable. Check the VOD URL.'
    );
  }
  return timestamp;
});

ipcMain.handle('download-video', async (event, arg) => {
  const error = getClipRangeError(arg?.startTime, arg?.endTime);
  if (error) throw new Error(error);
  const target = await outputFiles.target(arg.tournamentName, arg.title);
  await runYtDlp(
    arg.vodUrl,
    {
      downloadSections: `*${arg.startTime}-${arg.endTime}`,
      output: target.path.replace(/%/g, '%%'),
      noOverwrites: true,
    },
    nativeContext()
  );
  await outputFiles.video(target.folderName, target.videoName);
  return { folderName: target.folderName, videoName: target.videoName };
});

ipcMain.handle('get-tournament-folders', () => outputFiles.folders());
ipcMain.handle('get-videos-in-folder', (event, folderName: string) =>
  outputFiles.videos(folderName)
);

ipcMain.handle('get-youtube-status', () => youtubeAuth.status());
ipcMain.handle('connect-youtube', () => youtubeAuth.connect());
ipcMain.handle('disconnect-youtube', () => youtubeAuth.disconnect());

ipcMain.handle('save-thumbnail', async (event, args) => {
  await outputFiles.saveThumbnail(args, args.buf);
});

function resourceId(data: unknown, action: string) {
  const id: unknown =
    data && typeof data === 'object'
      ? Object.getOwnPropertyDescriptor(data, 'id')?.value
      : undefined;
  if (typeof id !== 'string' || !id) {
    throw new Error(
      `YouTube did not confirm ${action}. Check your channel and playlist before retrying.`
    );
  }
  return { id };
}

ipcMain.handle('upload-thumbnail', async (event, args) => {
  const file = await outputFiles.thumbnail(args);
  if (!file) return { status: 'skipped' };
  await youtubeAuth.request(args, 'upload the thumbnail', (headers) =>
    youtube.thumbnails.set(
      {
        videoId: args.videoId,
        media: { body: fs.createReadStream(file) },
      },
      { headers, retry: false }
    )
  );
  return { status: 'uploaded' };
});

ipcMain.handle('create-playlist', async (event, args) => {
  const data = await youtubeAuth.request(
    args,
    'create the playlist',
    (headers) =>
      youtube.playlists.insert(
        {
          part: ['id', 'snippet', 'status'],
          requestBody: {
            snippet: {
              title: args.playlistName,
              description: args.description,
            },
            status: {
              privacyStatus: args.visibility,
            },
          },
        },
        { headers, retry: false }
      )
  );
  return resourceId(data, 'playlist creation');
});

ipcMain.handle('add-video-to-playlist', async (event, args) => {
  const data = await youtubeAuth.request(
    args,
    'add the video to the playlist',
    (headers) =>
      youtube.playlistItems.insert(
        {
          part: ['id', 'snippet', 'status'],
          requestBody: {
            snippet: {
              playlistId: args.playlistId,
              resourceId: {
                kind: 'youtube#video',
                videoId: args.videoId,
              },
            },
          },
        },
        { headers, retry: false }
      )
  );
  return resourceId(data, 'playlist membership');
});

ipcMain.handle('upload-single-video', async (event, args: VideoUpload) => {
  const error = getVideoTitleError(args.title);
  if (error) throw new Error(error);
  const file = await outputFiles.video(args.folderName, args.videoName);
  const data = await youtubeAuth.request(args, 'upload the video', (headers) =>
    youtube.videos.insert(
      {
        part: ['id', 'snippet', 'status'],
        notifySubscribers: true,
        requestBody: {
          snippet: {
            title: args.title,
            description: args.description,
          },
          status: {
            privacyStatus: args.visibility,
            selfDeclaredMadeForKids: false,
          },
        },
        media: {
          body: fs.createReadStream(file),
        },
      },
      { headers, retry: false }
    )
  );
  return resourceId(data, 'video creation');
});

ipcMain.handle('get-api-key', async (event, arg) => {
  if (isDev) {
    return process.env.REACT_APP_STARTGG_API_KEY;
  }
  return '';
});

const rendererSettings = new Set([
  'apikey',
  'eventId',
  'station',
  'vodUrl',
  'characterMap',
]);
function exposedSetting(key: unknown): key is string {
  if (typeof key === 'string' && rendererSettings.has(key)) return true;
  console.warn('Blocked access to a main-process-only setting.');
  return false;
}

// YouTube credentials are never accessible through renderer settings APIs.
ipcMain.on('electron-store-get', async (event, val) => {
  event.returnValue = exposedSetting(val) ? store.get(val) : undefined;
});
ipcMain.on('electron-store-set', async (event, key, val) => {
  if (exposedSetting(key)) store.set(key, val);
});
ipcMain.on('electron-store-delete', async (event, val) => {
  if (exposedSetting(val)) store.delete(val);
});
ipcMain.handle(
  'electron-store-set-secret',
  async (event, key: string, value: string) => {
    if (key !== 'apikey' || typeof value !== 'string') {
      throw new Error('Invalid secret setting.');
    }
    if (value === '') {
      store.delete(key);
      return;
    }
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error(
        'Secure storage is unavailable. Unlock your system keychain and try again.'
      );
    }
    store.set(key, safeStorage.encryptString(value));
  }
);
ipcMain.handle('electron-store-get-secret', async (event, key: string) => {
  if (key !== 'apikey') throw new Error('Invalid secret setting.');
  const value = store.get(key);
  if (value == null || value === '') return '';
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'Secure storage is unavailable. Unlock your system keychain and try again.'
    );
  }
  if (typeof value === 'string') {
    store.set(key, safeStorage.encryptString(value));
    return value;
  }
  if (Buffer.isBuffer(value)) return safeStorage.decryptString(value);
  if (typeof value !== 'object' || value === null) {
    throw new Error('The saved API key is invalid. Save it again in settings.');
  }
  const serialized = value as { type?: unknown; data?: unknown };
  if (
    serialized.type !== 'Buffer' ||
    !Array.isArray(serialized.data) ||
    !serialized.data.every(
      (byte: unknown) =>
        typeof byte === 'number' &&
        Number.isInteger(byte) &&
        byte >= 0 &&
        byte <= 255
    )
  ) {
    throw new Error('The saved API key is invalid. Save it again in settings.');
  }
  return safeStorage.decryptString(Buffer.from(serialized.data));
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const createWindow = async () => {
  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 680,
    backgroundColor: '#202327',
    icon: getAssetPath('icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: resolvePreloadPath(__dirname, app.isPackaged),
    },
  });

  const development = process.env.NODE_ENV === 'development';
  if (!development && !rendererHost) {
    rendererHost = await startRendererHost(
      path.resolve(__dirname, '../renderer')
    );
  }
  const rendererUrl = development
    ? resolveHtmlPath('index.html')
    : rendererHost!.url;
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== new URL(rendererUrl).origin) {
      event.preventDefault();
    }
  });
  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });
  await mainWindow.loadURL(rendererUrl);
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    return createWindow();
  })
  .then(() => {
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch((error) => {
    console.error('Application startup failed', error);
    dialog.showErrorBox(
      'Could not start Tournament VOD Clipper',
      String(error)
    );
    app.quit();
  });

app.on('before-quit', () => youtubeAuth.stop());
app.on('will-quit', () => rendererHost?.server.close());
