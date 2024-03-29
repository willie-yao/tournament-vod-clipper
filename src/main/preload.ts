import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels = 'ipc-example';
export type electronAPI = 'electronAPI';

const electronHandler = {
  store: {
    get(key: any) {
      return ipcRenderer.sendSync('electron-store-get', key);
    },
    set(property: any, val: any) {
      ipcRenderer.send('electron-store-set', property, val);
    },
    // Other method you want to add like has(), reset(), etc.
    delete(key: any) {
      ipcRenderer.send('electron-store-delete', key);
    },
    getSecret(key: any) {
      return ipcRenderer.sendSync('electron-store-get-secret', key);
    },
    setSecret(property: any, val: any) {
      ipcRenderer.send('electron-store-set-secret', property, val);
    },
  },
  ipcRenderer: {
    sendMessage(channel: Channels, args: unknown[]) {
      ipcRenderer.send(channel, args);
    },
    openFolder(arg: string) {
      ipcRenderer.invoke('open-folder', arg);
    },
    createFolder(arg: string) {
      ipcRenderer.invoke('create-folder', arg);
    },
    downloadVideo(args: object) {
      return ipcRenderer.invoke('download-video', args);
    },
    retrieveVideoInformation(args: object) {
      return ipcRenderer.invoke('retrieve-video-information', args);
    },
    getTournamentFolders(arg: string) {
      return ipcRenderer.invoke('get-tournament-folders', arg);
    },
    getVideosInFolder(arg: string) {
      return ipcRenderer.invoke('get-videos-in-folder', arg);
    },
    openGoogleLogin(arg: string) {
      return ipcRenderer.invoke('open-google-login', arg);
    },
    createThumbnailFolder(arg: string) {
      return ipcRenderer.invoke('create-thumbnail-folder', arg);
    },
    saveThumbnail(args: object) {
      return ipcRenderer.invoke('save-thumbnail', args);
    },
    uploadThumbnail(args: object) {
      return ipcRenderer.invoke('upload-thumbnail', args);
    },
    createPlaylist(args: object) {
      return ipcRenderer.invoke('create-playlist', args);
    },
    uploadSingleVideo(args: object) {
      return ipcRenderer.invoke('upload-single-video', args);
    },
    addVideoToPlaylist(args: object) {
      return ipcRenderer.invoke('add-video-to-playlist', args);
    },
    uploadVideos(args: object) {
      return ipcRenderer.invoke('upload-videos', args);
    },
    getApiKey() {
      return ipcRenderer.invoke('get-api-key');
    },
    on(channel: any, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
      // ipcRenderer.once('create-folder', (_event, ...args) => func(...args));
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: Channels, data: any) => {
    let validChannels = ['create-folder']; // list of ipcMain.handle channels you want access in frontend to
    if (validChannels.includes(channel)) {
      // ipcRenderer.invoke accesses ipcMain.handle channels like 'myfunc'
      // make sure to include this return statement or you won't get your Promise back
      return ipcRenderer.invoke(channel, data);
    }
  },
});

export type ElectronHandler = typeof electronHandler;
