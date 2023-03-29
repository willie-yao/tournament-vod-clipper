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
import { app, BrowserWindow, shell, ipcMain, safeStorage, session } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
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

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

// Deep linked url
let deeplinkingUrl: any;

// Force Single Instance Application
const gotTheLock = app.requestSingleInstanceLock();
if (gotTheLock) {
  console.log('Got the lock');
  console.log('process.argv', process.argv);
  app.on('second-instance', (e, argv) => {
    // Someone tried to run a second instance, we should focus our window.
    console.log('second instance');
    // Protocol handler for win32
    // argv: An array of the second instance’s (command line / deep linked) arguments
    if (process.platform == 'win32') {
      // Keep only command line / deep linked arguments
      deeplinkingUrl = argv.slice(1);
    }
    logEverywhere('app.makeSingleInstance# ' + deeplinkingUrl);

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
  shell.openPath(process.cwd() + path.sep + 'downloadedVODs' + path.sep + arg.replace(":", "#"));
});

ipcMain.handle('retrieve-video-information', async (event, arg) => {
  return youtubeDl(arg.vodUrl, {
    printJson: true,
    skipDownload: true,
  }).then((output) => {
    // @ts-ignore
    return output.timestamp;
  }).catch((error) => {
    return error;
  });
});

ipcMain.handle('download-video', async (event, arg) => {
  console.log('args', arg);
  return youtubeDl(arg.vodUrl, {
    // @ts-ignore
    downloadSections: '*' + arg.startTime + '-' + arg.endTime,
    output: './downloadedVODs/' + arg.tournamentName + '/' + arg.title + '.mp4',
  });
});

ipcMain.handle('get-tournament-folders', async (event, arg) => {
  return fs
    .readdirSync(arg)
    .filter((file: any) => fs.statSync(arg + '/' + file).isDirectory());
});

ipcMain.handle('get-videos-in-folder', async (event, arg) => {
  return fs.readdirSync(arg).filter((file: any) => path.extname(file).toLowerCase() === '.mp4');
});

ipcMain.handle('open-google-login', async (event, arg) => {
  const myApiOauth = new ElectronGoogleOAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    ['https://www.googleapis.com/auth/youtube.upload'],
    { successRedirectURL: 'tournamentvodclipper://' }
  );

  return myApiOauth.openAuthWindowAndGetTokens();
});

ipcMain.handle('create-thumbnail-folder', async(event, arg) => {
  fs.mkdir('./downloadedVODs/' + arg.replace(":", "#") + "/thumbnails", { recursive: true }, (err: Error) => {
    if (err) throw err;
  })
})

ipcMain.handle('save-thumbnail', async (event, args) => {
  console.log("Saving thumbnail: ", args)
  // fs.mkdir('./downloadedVODs/' + args.folderName.replace(":", "#") + "/thumbnails", { recursive: true }, (err: Error) => {
  //   if (err) throw err;
  // })
  fs.writeFile("./downloadedVODs/" + args.folderName.replace(":", "#") + "/thumbnails/" + args.fileName.replace(":", "#") + ".jpg", args.buf, function (err: any) {
    if (err) {
      console.log(err);
    }
  })
})

ipcMain.handle('upload-thumbnail', async (event, args) => {
  let filepath = './downloadedVODs/' + args.folderName.replace(":", "#") + '/thumbnails/' + args.videoName.replace(":", "#") + '.jpg'
  console.log("Uploading thumbnail at path: ", filepath)
  if (!fs.existsSync(filepath)) {
    console.log("File does not exist")
    return
  }
  let response: any = await youtube.thumbnails.set(
    {
      videoId: args.videoId,
      media: {
        body: fs.createReadStream(filepath),
      },
      access_token: args.accessToken,
    }
  ).catch((error: any) => {
    console.log(error);
  });

  return response.data;
})

ipcMain.handle('upload-single-video', async (event, args) => {
  let response = await youtube.videos.insert(
    {
      part: 'id,snippet,status',
      notifySubscribers: true,
      requestBody: {
        snippet: {
          title: args.videoName.replace(/\.[^/.]+$/, ''),
          description: args.description,
        },
        status: {
          privacyStatus: args.visibility,
        },
      },
      media: {
        body: fs.createReadStream(args.path + args.videoName),
      },
      access_token: args.accessToken,
    }
  ).catch((error: any) => {
    console.log(error);
  });

  return response.data;
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
  })
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
ipcMain.on('electron-store-set-secret', async (event, key, val) => {
  store.set(key, safeStorage.encryptString(val));
});
ipcMain.on('electron-store-get-secret', async (event, val) => {
  let encryptedVal = store.get(val);
  if (encryptedVal) {
    event.returnValue = safeStorage.decryptString(
      Buffer.from(encryptedVal as Buffer)
    );
  } else {
    event.returnValue = '';
  }
});

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
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

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

// Log both at dev console and at running node console instance
function logEverywhere(s: any) {
  console.log(s);
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.executeJavaScript(`console.log("${s}")`);
  }
}

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
  console.log('open-url called');
  event.preventDefault();
  deeplinkingUrl = url;
  logEverywhere('open-url# ' + deeplinkingUrl);
  mainWindow?.webContents.send('login-success', { deeplinkingUrl });
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

    store.set('apikey', process.env.STARTGG_API_KEY);

    // works for dumb iFrames
    session.defaultSession.webRequest.onHeadersReceived({
      urls: [
        'https://www.twitch.tv/*',
        'https://player.twitch.tv/*',
        'https://embed.twitch.tv/*'
      ]
    }, (details, cb) => {
      var responseHeaders = details.responseHeaders;

      console.log('headers', details.url, responseHeaders);

      if (responseHeaders) {
        delete responseHeaders['Content-Security-Policy'];
      }

      cb({
        cancel: false,
        responseHeaders
      });
    });
  })
  .catch(console.log);
