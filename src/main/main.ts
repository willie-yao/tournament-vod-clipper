/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path, { resolve } from 'path';
import { app, BrowserWindow, shell, ipcMain, safeStorage } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import youtubeDl from 'youtube-dl-exec';
import * as dotenv from 'dotenv'; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();
import Store from 'electron-store';
import ElectronGoogleOAuth2 from '@getstation/electron-google-oauth2';
// import { upload } from 'youtube-videos-uploader'
// import { Video } from 'youtube-videos-uploader/dist/types';

const fs = require('fs');
const store = new Store();
const isDev = require('electron-is-dev');

// initialize the Youtube API library
const {google} = require('googleapis');
const youtube = google.youtube('v3');
const readline = require('readline');
const {authenticate} = require('@google-cloud/local-auth');

// very basic example of uploading a video to youtube
async function runSample(fileName: string) {
  // Obtain user credentials to use for the request
  const auth = await authenticate({
    keyfilePath: path.join(__dirname, '../oauth2.keys.json'),
    scopes: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
    ],
  });
  google.options({auth});

  const fileSize = fs.statSync(fileName).size;
  const res = await youtube.videos.insert(
    {
      part: 'id,snippet,status',
      notifySubscribers: false,
      requestBody: {
        snippet: {
          title: 'Node.js YouTube Upload Test',
          description: 'Testing YouTube upload via Google APIs Node.js Client',
        },
        status: {
          privacyStatus: 'private',
        },
      },
      media: {
        body: fs.createReadStream(fileName),
      },
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
  );
  console.log('\n\n');
  console.log(res.data);
  return res.data;
}

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

// Deep linked url
let deeplinkingUrl: any

// Force Single Instance Application
const gotTheLock = app.requestSingleInstanceLock()
if (gotTheLock) {
  console.log("Got the lock")
  console.log("process.argv", process.argv)
  app.on('second-instance', (e, argv) => {
    // Someone tried to run a second instance, we should focus our window.
    console.log("second instance")
    // Protocol handler for win32
    // argv: An array of the second instance’s (command line / deep linked) arguments
    if (process.platform == 'win32') {
      // Keep only command line / deep linked arguments
      deeplinkingUrl = argv.slice(1)
    }
    logEverywhere('app.makeSingleInstance# ' + deeplinkingUrl)

    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
} else {
  console.log("Did not get the lock")
  app.quit()
}

ipcMain.handle('create-folder', async (event, arg) => {
  fs.mkdir('./test-folder', { recursive: true }, (err: Error) => {
    if (err) throw err;
  });
});

ipcMain.handle('open-folder', async(event, arg) => {
  shell.openPath(process.cwd() + path.sep + 'downloadedVODs' + path.sep + arg)
})

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
  return youtubeDl(arg.vodUrl, {
    // @ts-ignore
    downloadSections: '*' + arg.startTime + '-' + arg.endTime,
    output: './downloadedVODs/' + arg.tournamentName + "/" + arg.title + '.mp4',
  });
});

ipcMain.handle('get-tournament-folders', async(event, arg) => {
  return fs.readdirSync(arg).filter((file: any) => fs.statSync(arg + '/'+ file).isDirectory())
})

ipcMain.handle('open-google-login', async(event, arg) => {
  // shell.openExternal("http://localhost:3000/")

  // const myApiOauth = new ElectronGoogleOAuth2(
  //   ['https://www.googleapis.com/auth/youtube.upload'],
  //   { successRedirectURL: 'tournamentvodclipper://' }
  // );

  return myApiOauth.openAuthWindowAndGetTokens()
})

ipcMain.handle('upload-videos', async(event, args) => {
  // const credentials = { email: args.email, recoveryemail: args.recoveryemail, pass: safeStorage.decryptString(Buffer.from(store.get('ytPassword') as Buffer))}
  // const videoList: Video[] = []
  fs.readdirSync(args.path).forEach((videoName: any) => {
    if (path.extname(videoName).toLowerCase() === '.mp4') {
      runSample(args.path + videoName).then(
        (data: any) => {
          console.log(data);
          return data
        }
      ).catch((err: any) => {
        console.log(err);
        return err
      })
      // const videoMetadata = { path: args.path + videoName, title: videoName.replace(/\.[^/.]+$/, ""), description: args.description, playlist: args.playlistName, isNotForKid: true }
      // videoList.push(videoMetadata)
      // console.log("videoMetadata", videoMetadata)
    }
  })
  // return upload(credentials, videoList)
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
  let encryptedVal = store.get(val)
  if (encryptedVal) {
    event.returnValue = safeStorage.decryptString(Buffer.from(encryptedVal as Buffer));
  } else {
    event.returnValue = ''
  }
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

// Log both at dev console and at running node console instance
function logEverywhere(s: any) {
  console.log(s)
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.executeJavaScript(`console.log("${s}")`)
  }
}

/**
 * Add event listeners...
*/

if (isDev && process.platform === 'win32') {
  // Set the path of electron.exe and your app.
  // These two additional parameters are only available on windows.
  // Setting this is required to get this working in dev mode.
  app.setAsDefaultProtocolClient('tournamentvodclipper', process.execPath, [process.argv[1]]);
} else {
  app.setAsDefaultProtocolClient('tournamentvodclipper');
}

app.on('open-url', function(event, url) {
  console.log("open-url called")
  event.preventDefault()
  deeplinkingUrl = url
  logEverywhere('open-url# ' + deeplinkingUrl)
  mainWindow?.webContents.send('login-success', { deeplinkingUrl })
})

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
