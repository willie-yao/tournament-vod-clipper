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
import { app, BrowserWindow, shell, ipcMain, safeStorage } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import youtubeDl from 'youtube-dl-exec';
import * as dotenv from 'dotenv'; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();
import Store from 'electron-store';
import { upload } from 'youtube-videos-uploader'

const fs = require('fs');
const store = new Store();
const isDev = require('electron-is-dev');

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

ipcMain.handle('create-folder', async (event, arg) => {
  fs.mkdir('./test-folder', { recursive: true }, (err: Error) => {
    if (err) throw err;
  });
});

ipcMain.handle('retrieve-video-information', async (event, arg) => {
  return youtubeDl(arg.vodUrl, {
    printJson: true,
    skipDownload: true,
  }).then((output) => {
    // @ts-ignore
    return output.timestamp;
  });
});

ipcMain.handle('download-video', async (event, arg) => {
  console.log('args', arg);
  youtubeDl(arg.vodUrl, {
    // @ts-ignore
    downloadSections: '*' + arg.startTime + '-' + arg.endTime,
    output: './downloadedVODs/' + arg.tournamentName + "/" + arg.title + '.mp4',
  }).then((output) => {});
});

ipcMain.handle('get-tournament-folders', async(event, arg) => {
  return fs.readdirSync(arg).filter((file: any) => fs.statSync(arg + '/'+ file).isDirectory())
})

ipcMain.handle('upload-videos', async(event, args) => {
  const credentials = { email: args.email, pass: safeStorage.decryptString(Buffer.from(store.get('ytPassword') as Buffer))}
  fs.readdirSync(args.path).forEach((videoName: any) => {
    if (path.extname(videoName).toLowerCase() === '.mp4') {
      const videoMetadata = { path: args.path + "/" + videoName, title: videoName.replace(/\.[^/.]+$/, ""), description: 'description 1' }
      console.log("videoMetadata", videoMetadata)
      upload(credentials, [videoMetadata]).then((response) => console.log("upload response", response))
        .catch(err => console.log("Error uploading video", err))
    }
  })
})

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
ipcMain.on('electron-store-set-secret', async(event, key, val) => {
  store.set(key, safeStorage.encryptString(val))
})
ipcMain.on('electron-store-get-secret', async (event, val) => {
  event.returnValue = safeStorage.decryptString(Buffer.from(store.get(val) as Buffer));
})

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
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
