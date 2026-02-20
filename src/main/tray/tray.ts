import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron'
import { join } from 'path'
import type { StaffManager } from '../staff-manager/staff-manager'
import { listStaffIds, readStaffConfig } from '../data/staff-data'
import { countJsonlLines } from '../data/jsonl-reader'
import { getStaffDir } from '../data/staff-data'

export function createTray(
  staffManager: StaffManager,
  mainWindow: BrowserWindow | null
): Tray {
  // Use template tray icon (macOS renders as monochrome menu bar icon)
  const iconPath = join(process.resourcesPath || join(__dirname, '../../resources'), 'trayTemplate.png')
  let icon: Electron.NativeImage
  try {
    icon = nativeImage.createFromPath(iconPath)
    icon.setTemplateImage(true)
  } catch {
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
      const statusIcon = status === 'running' ? '🟢' : status === 'error' ? '🔴' : '⚪'
      return {
        label: `${statusIcon} ${config.name} (Cycle #${cycles})`,
        click: (): void => {
          mainWindow?.show()
          mainWindow?.focus()
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
          mainWindow?.show()
          mainWindow?.focus()
        }
      },
      {
        label: 'Settings',
        click: (): void => {
          mainWindow?.show()
          mainWindow?.focus()
          mainWindow?.webContents.send('navigate', '/settings')
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

  // Update periodically
  setInterval(updateMenu, 30_000)

  tray.on('click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })

  return tray
}
