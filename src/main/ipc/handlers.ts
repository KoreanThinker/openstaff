import { dialog, app, BrowserWindow } from 'electron'
import type { IpcMain } from 'electron'
import type { ConfigStore } from '../store/config-store'
import { getApiPort } from '../api/server'
import { autoUpdater } from 'electron-updater'

export function setupIpcHandlers(
  ipcMain: IpcMain,
  configStore: ConfigStore,
  mainWindow: BrowserWindow | null
): void {
  ipcMain.handle('get-api-port', () => {
    return getApiPort()
  })

  ipcMain.handle('show-open-dialog', async (_event, options) => {
    return dialog.showOpenDialog(options)
  })

  ipcMain.handle('show-save-dialog', async (_event, options) => {
    return dialog.showSaveDialog(options)
  })

  ipcMain.handle('set-auto-start', (_event, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled })
    configStore.set('start_on_login', enabled)
  })

  ipcMain.handle('get-app-version', () => {
    return app.getVersion()
  })

  ipcMain.handle('check-for-updates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      if (result?.updateInfo) {
        return {
          updateAvailable: result.updateInfo.version !== app.getVersion(),
          version: result.updateInfo.version
        }
      }
      return { updateAvailable: false }
    } catch {
      return { updateAvailable: false }
    }
  })

  ipcMain.handle('download-update', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch {
      return { success: false }
    }
  })

  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall()
  })

  // Configure auto-updater
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update-downloaded')
  })
}
