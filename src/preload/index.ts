import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export const api = {
  getApiPort: (): Promise<number> => ipcRenderer.invoke('get-api-port'),
  showOpenDialog: (options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> =>
    ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options: Electron.SaveDialogOptions): Promise<Electron.SaveDialogReturnValue> =>
    ipcRenderer.invoke('show-save-dialog', options),
  onNotification: (callback: (data: { title: string; body: string }) => void): void => {
    ipcRenderer.on('notification', (_, data) => callback(data))
  },
  setAutoStart: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('set-auto-start', enabled),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: (): Promise<{ updateAvailable: boolean; version?: string }> =>
    ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('download-update'),
  installUpdate: (): Promise<void> =>
    ipcRenderer.invoke('install-update'),
  onUpdateDownloaded: (callback: () => void): void => {
    ipcRenderer.on('update-downloaded', () => callback())
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  ;(window as Window).electron = electronAPI
  ;(window as Window).api = api
}
