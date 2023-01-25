import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels = 'ipc-example';
export type electronAPI = 'electronAPI'

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, args: unknown[]) {
      ipcRenderer.send(channel, args);
    },
    createFolder(arg: string) {
      ipcRenderer.invoke('create-folder', arg);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
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

contextBridge.exposeInMainWorld(
  "electronAPI", {
      invoke: (channel: Channels, data: any) => {
          let validChannels = ["create-folder"]; // list of ipcMain.handle channels you want access in frontend to
          if (validChannels.includes(channel)) {
              // ipcRenderer.invoke accesses ipcMain.handle channels like 'myfunc'
              // make sure to include this return statement or you won't get your Promise back
              return ipcRenderer.invoke(channel, data); 
          }
      },
  }
);

export type ElectronHandler = typeof electronHandler;