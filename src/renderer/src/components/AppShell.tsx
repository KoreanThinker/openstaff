import * as React from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Puzzle,
  Bot,
  Store,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bell,
  Sun,
  Moon,
  Monitor
} from 'lucide-react'
import { useSidebarStore } from '@/stores/sidebar-store'
import { useSettingsStore } from '@/stores/settings-store'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/skills', label: 'Skills', icon: Puzzle },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/registry', label: 'Registry', icon: Store },
  { to: '/settings', label: 'Settings', icon: Settings }
]

function pageTitleFromPath(pathname: string): string {
  if (pathname === '/') return 'Dashboard'
  if (pathname.startsWith('/staffs/') && pathname.endsWith('/edit')) return 'Edit Staff'
  if (pathname === '/staffs/new') return 'New Staff'
  if (pathname.startsWith('/staffs/')) return 'Staff Detail'
  const item = navItems.find((n) => n.to === pathname)
  return item?.label ?? 'OpenStaff'
}

export function AppShell(): React.ReactElement {
  const { expanded, toggle } = useSidebarStore()
  const { theme, setTheme } = useSettingsStore()
  const location = useLocation()
  const pageTitle = pageTitleFromPath(location.pathname)

  const themeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col border-r border-border bg-card transition-all duration-300',
          expanded ? 'w-56' : 'w-16'
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center justify-center border-b border-border px-3">
          {expanded ? (
            <span className="text-lg font-bold text-foreground">OpenStaff</span>
          ) : (
            <span className="text-lg font-bold text-foreground">OS</span>
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  !expanded && 'justify-center px-0'
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {expanded && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Collapse Toggle */}
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className="w-full rounded-xl"
          >
            {expanded ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6">
          <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-xl">
                  {React.createElement(themeIcon, { className: 'h-4 w-4' })}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme('light')}>
                  <Sun className="mr-2 h-4 w-4" />
                  Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                  <Moon className="mr-2 h-4 w-4" />
                  Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}>
                  <Monitor className="mr-2 h-4 w-4" />
                  System
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notification Bell */}
            <Button variant="ghost" size="icon" className="rounded-xl">
              <Bell className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
