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
  session,
} from 'electron';
import MenuBuilder from './menu';
import { isAuthCallbackUrl, resolveHtmlPath } from './util';
import { getClipRangeError } from '../common/clipTime';
import youtubeDl from 'youtube-dl-exec';
import Store from 'electron-store';
import ElectronGoogleOAuth2 from '@getstation/electron-google-oauth2';
require('dotenv').config();
const fs = require('fs');
const store = new Store();
const isDev = require('electron-is-dev');

// initialize the Youtube API library
const { google } = require('googleapis');
const youtube = google.youtube('v3');
const readline = require('readline');

let mainWindow: BrowserWindow | null = null;

// Force Single Instance Application
const gotTheLock = app.requestSingleInstanceLock();
if (gotTheLock) {
  console.log('Got the lock');
  app.on('second-instance', (e, argv) => {
    // Someone tried to run a second instance, we should focus our window.
    console.log('second instance');
    const callbackUrl = argv.find(isAuthCallbackUrl);
    if (callbackUrl) {
      mainWindow?.webContents.send('login-success', {
        deeplinkingUrl: callbackUrl,
      });
    }

    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
} else {
  console.log('Did not get the lock');
  app.quit();
}

ipcMain.handle('create-folder', async (event, arg) => {
  fs.mkdir('./test-folder', { recursive: true }, (err: Error) => {
    if (err) throw err;
  });
});

ipcMain.handle('open-folder', async (event, arg) => {
  shell.openPath(
    process.cwd() +
      path.sep +
      'downloadedVODs' +
      path.sep +
      arg.replace(':', '#')
  );
});

ipcMain.handle('retrieve-video-information', async (event, arg) => {
  const output = await youtubeDl(arg.vodUrl, {
    printJson: true,
    skipDownload: true,
  });
  const timestamp: unknown =
    output && typeof output === 'object'
      ? Object.getOwnPropertyDescriptor(output, 'timestamp')?.value
      : undefined;
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
    throw new Error('The VOD start timestamp is unavailable. Check the VOD URL.');
  }
  return timestamp;
});

ipcMain.handle('download-video', async (event, arg) => {
  const error = getClipRangeError(arg?.startTime, arg?.endTime);
  if (error) throw new Error(error);
  return youtubeDl(arg.vodUrl, {
    // @ts-ignore
    downloadSections: `*${arg.startTime}-${arg.endTime}`,
    output: './downloadedVODs/' + arg.tournamentName + '/' + arg.title + '.mp4',
  });
});

ipcMain.handle('get-tournament-folders', async (event, arg) => {
  return fs
    .readdirSync(arg)
    .filter((file: any) => fs.statSync(arg + '/' + file).isDirectory());
});

ipcMain.handle('get-videos-in-folder', async (event, arg) => {
  return fs
    .readdirSync(arg)
    .filter((file: any) => path.extname(file).toLowerCase() === '.mp4');
});

ipcMain.handle('open-google-login', async (event, arg) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error(
      'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before logging in.'
    );
  }
  const myApiOauth = new ElectronGoogleOAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    [
      'https://www.googleapis.com/auth/youtube.force-ssl',
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtubepartner',
    ],
    { successRedirectURL: 'tournamentvodclipper://' }
  );

  return myApiOauth.openAuthWindowAndGetTokens();
});

ipcMain.handle('create-thumbnail-folder', async (event, arg) => {
  fs.mkdir(
    './downloadedVODs/' + arg.replace(':', '#') + '/thumbnails',
    { recursive: true },
    (err: Error) => {
      if (err) throw err;
    }
  );
});

ipcMain.handle('save-thumbnail', async (event, args) => {
  console.log('Saving thumbnail: ', args);
  // fs.mkdir('./downloadedVODs/' + args.folderName.replace(":", "#") + "/thumbnails", { recursive: true }, (err: Error) => {
  //   if (err) throw err;
  // })
  fs.writeFile(
    './downloadedVODs/' +
      args.folderName.replace(':', '#') +
      '/thumbnails/' +
      args.fileName.replace(':', '#') +
      '.jpg',
    args.buf,
    function (err: any) {
      if (err) {
        console.log(err);
      }
    }
  );
});

ipcMain.handle('upload-thumbnail', async (event, args) => {
  let filepath =
    './downloadedVODs/' +
    args.folderName.replace(':', '#') +
    '/thumbnails/' +
    args.videoName.replace(':', '#') +
    '.jpg';
  console.log('Uploading thumbnail at path: ', filepath);
  if (!fs.existsSync(filepath)) {
    console.log('File does not exist');
    return;
  }
  let response: any = await youtube.thumbnails
    .set({
      videoId: args.videoId,
      media: {
        body: fs.createReadStream(filepath),
      },
      access_token: args.accessToken,
    })
    .catch((error: any) => {
      console.log(error);
    });

  return response.data;
});

ipcMain.handle('create-playlist', async (event, args) => {
  try {
    let response = await youtube.playlists.insert({
      part: 'id,snippet,status',
      requestBody: {
        snippet: {
          title: args.playlistName,
          description: args.description,
        },
        status: {
          privacyStatus: args.visibility,
        },
      },
      access_token: args.accessToken,
    });
    return response.data;
  } catch (e) {
    console.log('Error creating playlist', e);
  }
});

ipcMain.handle('add-video-to-playlist', async (event, args) => {
  try {
    let response = await youtube.playlistItems.insert({
      part: 'id,snippet,status',
      requestBody: {
        snippet: {
          playlistId: args.playlistId,
          resourceId: {
            kind: 'youtube#video',
            videoId: args.videoId,
          },
        },
      },
      access_token: args.accessToken,
    });
    return response.data;
  } catch (e) {
    console.log('Error adding video to playlist', e);
  }
});

ipcMain.handle('upload-single-video', async (event, args) => {
  try {
    let response = await youtube.videos.insert({
      part: 'id,snippet,status',
      notifySubscribers: true,
      requestBody: {
        snippet: {
          title: args.videoName.replace(/\.[^/.]+$/, ''),
          description: args.description,
        },
        status: {
          privacyStatus: args.visibility,
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: fs.createReadStream(args.path + args.videoName),
      },
      access_token: args.accessToken,
    });
    return response.data;
  } catch (e) {
    console.log('Error uploading video', e);
  }
});

ipcMain.handle('upload-videos', async (event, args) => {
  return fs.readdirSync(args.path).forEach((videoName: any) => {
    const fileSize = fs.statSync(args.path + videoName).size;
    if (path.extname(videoName).toLowerCase() === '.mp4') {
      console.log('videoName', videoName);
      return youtube.videos
        .insert(
          {
            part: 'id,snippet,status',
            notifySubscribers: true,
            requestBody: {
              snippet: {
                title: videoName.replace(/\.[^/.]+$/, ''),
                description: args.description,
              },
              status: {
                privacyStatus: args.visibility,
              },
            },
            media: {
              body: fs.createReadStream(args.path + videoName),
            },
            access_token: args.accessToken,
          },
          {
            // Use the `onUploadProgress` event from Axios to track the
            // number of bytes uploaded to this point.
            onUploadProgress: (evt: any) => {
              const progress = (evt.bytesRead / fileSize) * 100;
              readline.clearLine(process.stdout, 0);
              readline.cursorTo(process.stdout, 0, null);
              process.stdout.write(`${Math.round(progress)}% complete`);
            },
          }
        )
        .then((response: any) => {
          console.log('response', response);
        })
        .catch((error: any) => {
          console.log('error', error);
          return error.errors[0].message;
        });
    }
  });
});

ipcMain.handle('get-api-key', async (event, arg) => {
  if (isDev) {
    event.returnValue = process.env.REACT_APP_STARTGG_API_KEY;
    return process.env.REACT_APP_STARTGG_API_KEY;
  }
  return '';
});

// IPC listener
ipcMain.on('electron-store-get', async (event, val) => {
  event.returnValue = store.get(val);
});
ipcMain.on('electron-store-set', async (event, key, val) => {
  store.set(key, val);
});
ipcMain.on('electron-store-delete', async (event, val) => {
  store.delete(val);
});
ipcMain.handle(
  'electron-store-set-secret',
  async (event, key: string, value: string) => {
    if (typeof key !== 'string' || typeof value !== 'string') {
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

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      // contextIsolation: false,
      // nodeIntegration: true,
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

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
};

/**
 * Add event listeners...
 */

if (isDev && process.platform === 'win32') {
  // Set the path of electron.exe and your app.
  // These two additional parameters are only available on windows.
  // Setting this is required to get this working in dev mode.
  app.setAsDefaultProtocolClient('tournamentvodclipper', process.execPath, [
    process.argv[1],
  ]);
} else {
  app.setAsDefaultProtocolClient('tournamentvodclipper');
}

app.on('open-url', function (event, url) {
  event.preventDefault();
  if (!isAuthCallbackUrl(url)) {
    console.warn('Ignoring unexpected login callback URL');
    return;
  }
  mainWindow?.webContents.send('login-success', { deeplinkingUrl: url });
});

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
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });

    // works for dumb iFrames
    session.defaultSession.webRequest.onHeadersReceived(
      {
        urls: [
          'https://www.twitch.tv/*',
          'https://player.twitch.tv/*',
          'https://embed.twitch.tv/*',
        ],
      },
      (details, cb) => {
        var responseHeaders = details.responseHeaders;

        console.log('headers', details.url, responseHeaders);

        if (responseHeaders) {
          delete responseHeaders['Content-Security-Policy'];
        }

        cb({
          cancel: false,
          responseHeaders,
        });
      }
    );
  })
  .catch(console.log);
