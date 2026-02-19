import { dialog, app, BrowserWindow } from 'electron'
import type { IpcMain } from 'electron'
import type { ConfigStore } from '../store/config-store'
import { getApiPort } from '../api/server'

export function setupIpcHandlers(
  ipcMain: IpcMain,
  configStore: ConfigStore,
  _mainWindow: BrowserWindow | null
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
    // TODO: implement with electron-updater
    return { updateAvailable: false }
  })
}
