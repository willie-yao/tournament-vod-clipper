import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { VideoFile, VideoUpload } from '../common/files';
import type { YouTubeSession, YouTubeStatus } from '../common/youtube';
import type { VideoInformationResult } from '../common/retrieval';

export type Channels = 'ipc-example';
export type electronAPI = 'electronAPI';

const metadataRequests = new Set<string>();
const cancelMetadata = () => {
  metadataRequests.forEach((requestId) =>
    ipcRenderer.send('cancel-retrieve-video-information', requestId)
  );
  metadataRequests.clear();
  window.removeEventListener('unload', cancelMetadata);
};
const forgetMetadata = (requestId: string) => {
  metadataRequests.delete(requestId);
  if (!metadataRequests.size)
    window.removeEventListener('unload', cancelMetadata);
};

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
    async retrieveVideoInformation(args: {
      vodUrl: string;
      requestId: string;
    }): Promise<VideoInformationResult> {
      metadataRequests.add(args.requestId);
      if (metadataRequests.size === 1)
        window.addEventListener('unload', cancelMetadata);
      try {
        return await ipcRenderer.invoke('retrieve-video-information', args);
      } finally {
        forgetMetadata(args.requestId);
      }
    },
    cancelRetrieveVideoInformation(requestId: string): void {
      ipcRenderer.send('cancel-retrieve-video-information', requestId);
      forgetMetadata(requestId);
    },
    getTournamentFolders(): Promise<string[]> {
      return ipcRenderer.invoke('get-tournament-folders');
    },
    getVideosInFolder(arg: string): Promise<string[]> {
      return ipcRenderer.invoke('get-videos-in-folder', arg);
    },
    getYouTubeStatus(): Promise<YouTubeStatus> {
      return ipcRenderer.invoke('get-youtube-status');
    },
    connectYouTube(): Promise<YouTubeStatus> {
      return ipcRenderer.invoke('connect-youtube');
    },
    disconnectYouTube(): Promise<YouTubeStatus> {
      return ipcRenderer.invoke('disconnect-youtube');
    },
    onYouTubeStatus(listener: (status: YouTubeStatus) => void) {
      const subscription = (_event: IpcRendererEvent, status: YouTubeStatus) =>
        listener(status);
      ipcRenderer.on('youtube-status', subscription);
      return () => ipcRenderer.removeListener('youtube-status', subscription);
    },
    saveThumbnail(args: VideoFile & { buf: Uint8Array }): Promise<void> {
      return ipcRenderer.invoke('save-thumbnail', args);
    },
    uploadThumbnail(
      args: VideoFile & YouTubeSession & { videoId: string }
    ): Promise<{ status: 'uploaded' | 'skipped' }> {
      return ipcRenderer.invoke('upload-thumbnail', args);
    },
    createPlaylist(
      args: YouTubeSession & {
        playlistName: string;
        description: string;
        visibility: string;
      }
    ): Promise<{ id: string }> {
      return ipcRenderer.invoke('create-playlist', args);
    },
    uploadSingleVideo(args: VideoUpload): Promise<{ id: string }> {
      return ipcRenderer.invoke('upload-single-video', args);
    },
    addVideoToPlaylist(
      args: YouTubeSession & { playlistId: string; videoId: string }
    ): Promise<{ id: string }> {
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
