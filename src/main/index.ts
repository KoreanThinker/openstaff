import { app, shell, BrowserWindow, ipcMain, Tray, Notification } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

// Isolate user data per test run (for E2E tests)
if (process.env.ELECTRON_USER_DATA_DIR) {
  app.setPath('userData', process.env.ELECTRON_USER_DATA_DIR)
}
import { startApiServer } from './api/server'
import { StaffManager } from './staff-manager/staff-manager'
import { setupIpcHandlers } from './ipc/handlers'
import { createTray } from './tray/tray'
import { ConfigStore } from './store/config-store'
import { HealthChecker } from './health-check/health-checker'
import { MonitoringEngine } from './monitoring/monitoring-engine'
import { NgrokManager } from './ngrok/ngrok-manager'

let mainWindow: BrowserWindow | null = null
let _tray: Tray | null = null

const configStore = new ConfigStore()
const staffManager = new StaffManager(configStore)
const healthChecker = new HealthChecker(staffManager)
const monitoringEngine = new MonitoringEngine(staffManager)
const ngrokManager = new NgrokManager(configStore)

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
      preload: join(__dirname, '../preload/index.mjs'),
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

  // Sync auto-start setting with OS login items
  const startOnLogin = configStore.get('start_on_login', true)
  app.setLoginItemSettings({ openAtLogin: startOnLogin as boolean })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const apiServer = await startApiServer(staffManager, configStore, monitoringEngine, ngrokManager)

  setupIpcHandlers(ipcMain, configStore)
  _tray = createTray(staffManager, mainWindow)

  createWindow()

  healthChecker.start()
  monitoringEngine.start()

  // Start Ngrok tunnel if API key is configured
  ngrokManager.start(apiServer.port).then((url) => {
    if (url) console.log(`Remote access available at: ${url}`)
  }).catch((err) => {
    console.error('Failed to start Ngrok tunnel:', err)
  })

  await staffManager.recoverRunningStaffs()

  // Native notifications for staff events
  staffManager.on('staff:error', (staffId: string) => {
    const config = staffManager.getStaffConfig(staffId)
    new Notification({
      title: 'Staff Error',
      body: `${config?.name || staffId} crashed and is restarting.`
    }).show()
  })

  staffManager.on('staff:giveup', (staffId: string) => {
    const config = staffManager.getStaffConfig(staffId)
    new Notification({
      title: 'Staff Needs Help',
      body: `${config?.name || staffId} gave up and stopped. Check the Errors tab.`
    }).show()
  })

  staffManager.on('staff:stopped_backoff', (staffId: string) => {
    const config = staffManager.getStaffConfig(staffId)
    new Notification({
      title: 'Staff Stopped',
      body: `${config?.name || staffId} stopped after repeated failures.`
    }).show()
  })

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
