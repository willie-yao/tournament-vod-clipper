import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { VideoFile, VideoUpload } from '../common/files';

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
    getSecret(key: string): Promise<string> {
      return ipcRenderer.invoke('electron-store-get-secret', key);
    },
    setSecret(property: string, val: string): Promise<void> {
      return ipcRenderer.invoke('electron-store-set-secret', property, val);
    },
  },
  ipcRenderer: {
    sendMessage(channel: Channels, args: unknown[]) {
      ipcRenderer.send(channel, args);
    },
    getOutputDirectory(): Promise<string> {
      return ipcRenderer.invoke('get-output-directory');
    },
    chooseOutputDirectory(): Promise<string | null> {
      return ipcRenderer.invoke('choose-output-directory');
    },
    openFolder(arg: string): Promise<void> {
      return ipcRenderer.invoke('open-folder', arg);
    },
    createFolder(): Promise<string> {
      return ipcRenderer.invoke('create-folder');
    },
    downloadVideo(args: object): Promise<VideoFile> {
      return ipcRenderer.invoke('download-video', args);
    },
    retrieveVideoInformation(args: { vodUrl: string }): Promise<number> {
      return ipcRenderer.invoke('retrieve-video-information', args);
    },
    getTournamentFolders(): Promise<string[]> {
      return ipcRenderer.invoke('get-tournament-folders');
    },
    getVideosInFolder(arg: string): Promise<string[]> {
      return ipcRenderer.invoke('get-videos-in-folder', arg);
    },
    openGoogleLogin(): Promise<{ access_token?: string }> {
      return ipcRenderer.invoke('open-google-login');
    },
    saveThumbnail(args: VideoFile & { buf: Uint8Array }): Promise<void> {
      return ipcRenderer.invoke('save-thumbnail', args);
    },
    uploadThumbnail(
      args: VideoFile & { videoId: string; accessToken: string }
    ): Promise<{ status: 'uploaded' | 'skipped' }> {
      return ipcRenderer.invoke('upload-thumbnail', args);
    },
    createPlaylist(args: object): Promise<{ id: string }> {
      return ipcRenderer.invoke('create-playlist', args);
    },
    uploadSingleVideo(args: VideoUpload): Promise<{ id: string }> {
      return ipcRenderer.invoke('upload-single-video', args);
    },
    addVideoToPlaylist(args: object): Promise<{ id: string }> {
      return ipcRenderer.invoke('add-video-to-playlist', args);
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

if (process.isMainFrame) {
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
}

export type ElectronHandler = typeof electronHandler;
