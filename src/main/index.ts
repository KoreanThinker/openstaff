import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { startApiServer } from './api/server'
import { StaffManager } from './staff-manager/staff-manager'
import { setupIpcHandlers } from './ipc/handlers'
import { createTray } from './tray/tray'
import { ConfigStore } from './store/config-store'
import { HealthChecker } from './health-check/health-checker'
import { MonitoringEngine } from './monitoring/monitoring-engine'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

const configStore = new ConfigStore()
const staffManager = new StaffManager(configStore)
const healthChecker = new HealthChecker(staffManager)
const monitoringEngine = new MonitoringEngine(staffManager)

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    const showOnStartup = configStore.get('show_window_on_startup', true)
    if (showOnStartup) {
      mainWindow?.show()
    }
  })

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.openstaff.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const apiServer = await startApiServer(staffManager, configStore, monitoringEngine)

  setupIpcHandlers(ipcMain, configStore, mainWindow)
  tray = createTray(staffManager, mainWindow)

  createWindow()

  healthChecker.start()
  monitoringEngine.start()

  await staffManager.recoverRunningStaffs()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow?.show()
    }
  })
})

app.on('before-quit', async () => {
  (app as Electron.App & { isQuitting: boolean }).isQuitting = true
  healthChecker.stop()
  monitoringEngine.stop()
  await staffManager.stopAll()
})

app.on('window-all-closed', () => {
  // Don't quit on window close - Docker Desktop model
})

declare module 'electron' {
  interface App {
    isQuitting: boolean
  }
}

app.isQuitting = false
