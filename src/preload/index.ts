import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export const api = {
  getApiPort: (): Promise<number> => ipcRenderer.invoke('get-api-port'),
  platform: process.platform as NodeJS.Platform,
  getPlatform: (): Promise<NodeJS.Platform> => ipcRenderer.invoke('get-platform'),
  showOpenDialog: (options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> =>
    ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options: Electron.SaveDialogOptions): Promise<Electron.SaveDialogReturnValue> =>
    ipcRenderer.invoke('show-save-dialog', options),
  selectDirectory: async (): Promise<string | null> => {
    const result = await ipcRenderer.invoke('show-open-dialog', {
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0] || null
  },
  selectFile: async (opts?: { filters?: { name: string; extensions: string[] }[] }): Promise<string | null> => {
    const result = await ipcRenderer.invoke('show-open-dialog', {
      properties: ['openFile'],
      filters: opts?.filters
    })
    return result.canceled ? null : result.filePaths[0] || null
  },
  onNotification: (callback: (data: { title: string; body: string }) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: { title: string; body: string }): void => callback(data)
    ipcRenderer.on('notification', handler)
    return () => ipcRenderer.removeListener('notification', handler)
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
  onUpdateDownloaded: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('update-downloaded', handler)
    return () => ipcRenderer.removeListener('update-downloaded', handler)
  },
  onNavigate: (callback: (path: string) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, path: string): void => callback(path)
    ipcRenderer.on('navigate', handler)
    return () => ipcRenderer.removeListener('navigate', handler)
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
