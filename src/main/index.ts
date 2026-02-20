import { app, shell, BrowserWindow, ipcMain, Tray, Notification } from 'electron'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
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
import { SlackNotifier } from './integrations/slack-notifier'

const __dirname = dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null
let _tray: Tray | null = null
let apiServerRef: { port: number; close: () => void } | null = null

const configStore = new ConfigStore()
const staffManager = new StaffManager(configStore)
const healthChecker = new HealthChecker(staffManager)
const monitoringEngine = new MonitoringEngine(staffManager, configStore)
const ngrokManager = new NgrokManager(configStore)
const slackNotifier = new SlackNotifier(configStore)
const hideWindowForE2E =
  process.env.NODE_ENV === 'test' && process.env.OPENSTAFF_E2E_SHOW_WINDOW !== '1'

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
    if (hideWindowForE2E) return
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
  apiServerRef = apiServer

  setupIpcHandlers(ipcMain, configStore)
  _tray = createTray(staffManager)

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
    const name = config?.name || staffId
    new Notification({
      title: 'Staff Error',
      body: `${name} crashed and is restarting.`
    }).show()
    slackNotifier.notify('Staff Error', `${name} crashed and is restarting.`).catch(() => {})
  })

  staffManager.on('staff:giveup', (staffId: string) => {
    const config = staffManager.getStaffConfig(staffId)
    const name = config?.name || staffId
    new Notification({
      title: 'Staff Paused',
      body: `${name} gave up and is paused. Resume it after investigating.`
    }).show()
    slackNotifier.notify('Staff Paused', `${name} gave up and is paused. Resume it after investigating.`).catch(() => {})
  })

  staffManager.on('staff:stopped_backoff', (staffId: string) => {
    const config = staffManager.getStaffConfig(staffId)
    const name = config?.name || staffId
    new Notification({
      title: 'Staff Stopped',
      body: `${name} stopped after repeated failures.`
    }).show()
    slackNotifier.notify('Staff Stopped', `${name} stopped after repeated failures.`).catch(() => {})
  })

  staffManager.on('staff:health_check_fail', (staffId: string) => {
    const config = staffManager.getStaffConfig(staffId)
    const name = config?.name || staffId
    new Notification({
      title: 'Health Check Failed',
      body: `${name} is unresponsive. Attempting restart...`
    }).show()
    slackNotifier.notify('Health Check Failed', `${name} is unresponsive. Attempting restart...`).catch(() => {})
    // Trigger restart via error handler path
    staffManager.restartStaff(staffId).catch((err: Error) => {
      console.error(`Failed to restart unresponsive staff ${staffId}:`, err)
    })
  })

  staffManager.on('budget:warning', (data: { monthly_cost: number; budget_limit: number; warning_percent: number }) => {
    const body = `Monthly cost ($${data.monthly_cost}) has reached ${data.warning_percent}% of your $${data.budget_limit} budget.`
    new Notification({
      title: 'Budget Warning',
      body
    }).show()
    slackNotifier.notify('Budget Warning', body).catch(() => {})
  })

  app.on('activate', () => {
    if (hideWindowForE2E) return
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow?.show()
    }
  })
})

app.on('before-quit', (event) => {
  if (!app.isQuitting) {
    event.preventDefault()
    app.isQuitting = true
    healthChecker.stop()
    monitoringEngine.stop()
    Promise.all([
      ngrokManager.stop().catch(() => {}),
      staffManager.stopAll().catch(() => {})
    ]).finally(() => {
      if (apiServerRef) apiServerRef.close()
      app.quit()
    })
  }
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
