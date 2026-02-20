import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import type { StaffManager } from '../staff-manager/staff-manager'
import { listStaffIds, readStaffConfig } from '../data/staff-data'
import { countJsonlLines } from '../data/jsonl-reader'
import { getStaffDir } from '../data/staff-data'

function resolveTrayIconPath(): string | null {
  const candidatePaths = [
    join(process.resourcesPath, 'trayTemplate.png'),
    join(app.getAppPath(), 'resources', 'trayTemplate.png'),
    join(app.getAppPath(), 'build', 'trayTemplate.png'),
    join(__dirname, '../../resources', 'trayTemplate.png'),
    join(__dirname, '../../build', 'trayTemplate.png'),
    join(process.cwd(), 'resources', 'trayTemplate.png'),
    join(process.cwd(), 'build', 'trayTemplate.png')
  ]

  return candidatePaths.find((candidate) => existsSync(candidate)) ?? null
}

export function createTray(
  staffManager: StaffManager
): Tray {
  // Use template tray icon (macOS renders as monochrome menu bar icon).
  const iconPath = resolveTrayIconPath()
  let icon: Electron.NativeImage
  if (iconPath) {
    const resolved = nativeImage.createFromPath(iconPath)
    if (!resolved.isEmpty()) {
      icon = resolved
      icon.setTemplateImage(true)
    } else {
      icon = nativeImage.createEmpty()
    }
  } else {
    icon = nativeImage.createEmpty()
  }
  const tray = new Tray(icon)
  tray.setToolTip('OpenStaff')

  const updateMenu = (): void => {
    const ids = listStaffIds()
    const staffItems: Electron.MenuItemConstructorOptions[] = ids.map((id) => {
      const config = readStaffConfig(id)
      if (!config) return { label: id, enabled: false }
      const status = staffManager.getStatus(id)
      const dir = getStaffDir(id)
      const cycles = countJsonlLines(join(dir, 'cycles.jsonl'))
      const statusIcon = status === 'running' ? '🟢' : status === 'paused' ? '🟡' : status === 'error' ? '🔴' : '⚪'
      return {
        label: `${statusIcon} ${config.name} (Cycle #${cycles})`,
        click: (): void => {
          const win = BrowserWindow.getAllWindows()[0]
          win?.show()
          win?.focus()
        }
      }
    })

    const contextMenu = Menu.buildFromTemplate([
      { label: 'OpenStaff', enabled: false },
      { type: 'separator' },
      ...staffItems,
      ...(staffItems.length > 0 ? [{ type: 'separator' as const }] : []),
      {
        label: 'Open Dashboard',
        click: (): void => {
          const win = BrowserWindow.getAllWindows()[0]
          win?.show()
          win?.focus()
        }
      },
      {
        label: 'Settings',
        click: (): void => {
          const win = BrowserWindow.getAllWindows()[0]
          win?.show()
          win?.focus()
          win?.webContents.send('navigate', '/settings')
        }
      },
      { type: 'separator' },
      {
        label: 'Quit OpenStaff',
        click: (): void => {
          app.isQuitting = true
          app.quit()
        }
      }
    ])

    tray.setContextMenu(contextMenu)
  }

  updateMenu()

  // Update tray menu on staff status changes
  staffManager.on('staff:status', () => updateMenu())

  // Update periodically (lives for app lifetime, cleaned up on process exit)
  setInterval(updateMenu, 30_000)

  tray.on('click', () => {
    const win = BrowserWindow.getAllWindows()[0]
    win?.show()
    win?.focus()
  })

  return tray
}
