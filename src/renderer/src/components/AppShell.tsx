import * as React from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
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
  Monitor,
  Search,
  AlertTriangle,
  XCircle,
  Info
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useSidebarStore } from '@/stores/sidebar-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useHeaderActionStore } from '@/stores/header-action-store'
import { useNotificationStore } from '@/stores/notification-store'
import { getSocket } from '@/lib/socket'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { OpenStaffLogo } from '@/components/brand/OpenStaffLogo'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

const notificationIcon = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info
} as const

const notificationColor = {
  error: 'text-destructive',
  warning: 'text-warning',
  info: 'text-muted-foreground'
} as const

export function AppShell(): React.ReactElement {
  const { expanded, toggle } = useSidebarStore()
  const { theme, setTheme } = useSettingsStore()
  const { actionButton } = useHeaderActionStore()
  const { notifications, unreadCount, addNotification, markAllRead, clearAll } =
    useNotificationStore()
  const location = useLocation()
  const navigate = useNavigate()
  const pageTitle = pageTitleFromPath(location.pathname)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [isMacDesktop, setIsMacDesktop] = React.useState(() => {
    if (typeof navigator === 'undefined') return false
    const platform = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent
    return /mac/i.test(platform)
  })

  React.useEffect(() => {
    let active = true
    const fallbackDetect = (): void => {
      const platform = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent
      if (active) setIsMacDesktop(/mac/i.test(platform))
    }

    if (typeof window === 'undefined' || !window.api?.getPlatform) {
      fallbackDetect()
      return () => { active = false }
    }

    window.api.getPlatform()
      .then((platform) => {
        if (active) setIsMacDesktop(platform === 'darwin')
      })
      .catch(() => fallbackDetect())

    return () => { active = false }
  }, [])

  // IPC navigate listener (tray Settings click)
  React.useEffect(() => {
    const cleanup = window.api?.onNavigate?.((path: string) => {
      navigate(path)
    })
    return () => cleanup?.()
  }, [navigate])

  // Socket event listeners for notifications
  React.useEffect(() => {
    const socket = getSocket()

    const onStaffError = (data: { staffId: string; error?: string }) => {
      addNotification({
        title: 'Staff Error',
        body: `Staff ${data.staffId} encountered an error${data.error ? `: ${data.error}` : ''}.`,
        type: 'error'
      })
    }

    const onStaffGiveup = (data: { staffId: string }) => {
      addNotification({
        title: 'Staff Paused',
        body: `Staff ${data.staffId} gave up and is now paused.`,
        type: 'warning'
      })
    }

    const onBudgetWarning = (data: {
      monthly_cost: number
      budget_limit: number
      warning_percent: number
    }) => {
      addNotification({
        title: 'Budget Warning',
        body: `Monthly cost ($${data.monthly_cost}) has reached ${data.warning_percent}% of your $${data.budget_limit} budget.`,
        type: 'warning'
      })
    }

    const onStaffStoppedBackoff = (data: { staffId: string }) => {
      addNotification({
        title: 'Staff Stopped',
        body: `Staff ${data.staffId} stopped after repeated failures.`,
        type: 'error'
      })
    }

    socket.on('staff:error', onStaffError)
    socket.on('staff:giveup', onStaffGiveup)
    socket.on('budget:warning', onBudgetWarning)
    socket.on('staff:stopped_backoff', onStaffStoppedBackoff)

    return () => {
      socket.off('staff:error', onStaffError)
      socket.off('staff:giveup', onStaffGiveup)
      socket.off('budget:warning', onBudgetWarning)
      socket.off('staff:stopped_backoff', onStaffStoppedBackoff)
    }
  }, [addNotification])

  // Cmd+K / Ctrl+K shortcut
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        setTimeout(() => searchRef.current?.focus(), 0)
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
        setSearchQuery('')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [searchOpen])

  // Search data
  const { data: searchStaffs } = useQuery({
    queryKey: ['staffs'],
    queryFn: () => api.getStaffs(),
    enabled: searchOpen
  })
  const { data: searchSkills } = useQuery({
    queryKey: ['skills'],
    queryFn: () => api.getSkills(),
    enabled: searchOpen
  })

  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) return { staffs: [], skills: [], pages: [] }
    const q = searchQuery.toLowerCase()
    const staffs = (searchStaffs ?? [])
      .filter((s) => s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q))
      .slice(0, 5)
    const skills = (searchSkills ?? [])
      .filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
      .slice(0, 3)
    const pages = navItems
      .filter((n) => n.label.toLowerCase().includes(q))
    return { staffs, skills, pages }
  }, [searchQuery, searchStaffs, searchSkills])

  const hasResults = searchResults.staffs.length > 0 || searchResults.skills.length > 0 || searchResults.pages.length > 0

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
        <div
          className={cn(
            'flex items-center border-b border-border',
            isMacDesktop ? 'h-16 pt-2' : 'h-14',
            expanded
              ? isMacDesktop
                ? 'justify-start pl-[5.5rem] pr-3'
                : 'justify-start px-3'
              : isMacDesktop
                ? 'justify-end pr-2'
                : 'justify-center'
          )}
        >
          {expanded ? (
            <OpenStaffLogo
              showWordmark
              size={22}
              wordmarkVariant="split"
              wordmarkClassName="text-[1.02rem]"
            />
          ) : (
            <OpenStaffLogo size={22} />
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
              <span className={cn(
                'transition-all duration-300 overflow-hidden whitespace-nowrap',
                expanded ? 'max-w-[120px] opacity-100' : 'max-w-0 opacity-0'
              )}>
                {item.label}
              </span>
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
            aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
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

          {/* Center: Search Bar */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Search staffs, skills...  ⌘K"
              className="w-80 rounded-full border-none bg-muted pl-9 pr-4 py-2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && hasResults) {
                  const firstStaff = searchResults.staffs.at(0)
                  const firstPage = searchResults.pages.at(0)
                  if (firstStaff) {
                    navigate(`/staffs/${firstStaff.id}`)
                  } else if (firstPage) {
                    navigate(firstPage.to)
                  } else {
                    navigate('/skills')
                  }
                  setSearchOpen(false)
                  setSearchQuery('')
                }
              }}
            />
            {searchOpen && searchQuery.trim() && (
              <div className="absolute left-0 top-full mt-2 w-80 rounded-xl border border-border bg-popover p-2 shadow-md z-50">
                {!hasResults && (
                  <p className="px-3 py-4 text-center text-sm text-muted-foreground">No results found</p>
                )}
                {searchResults.staffs.length > 0 && (
                  <div>
                    <p className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase">Staff</p>
                    {searchResults.staffs.map((s) => (
                      <button
                        key={s.id}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          navigate(`/staffs/${s.id}`)
                          setSearchOpen(false)
                          setSearchQuery('')
                        }}
                      >
                        <Bot className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{s.role}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.skills.length > 0 && (
                  <div className="mt-1">
                    <p className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase">Skills</p>
                    {searchResults.skills.map((s) => (
                      <button
                        key={s.name}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          navigate('/skills')
                          setSearchOpen(false)
                          setSearchQuery('')
                        }}
                      >
                        <Puzzle className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{s.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{s.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.pages.length > 0 && (
                  <div className="mt-1">
                    <p className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase">Pages</p>
                    {searchResults.pages.map((p) => (
                      <button
                        key={p.to}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors text-left"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          navigate(p.to)
                          setSearchOpen(false)
                          setSearchQuery('')
                        }}
                      >
                        <p.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <p className="font-medium">{p.label}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Screen-specific action button */}
            {actionButton}

            {/* Theme Toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-xl" aria-label="Toggle theme">
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative rounded-xl" aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}>
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full p-0 text-[10px]"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm font-medium text-foreground">Notifications</span>
                  {notifications.length > 0 && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={markAllRead}
                      >
                        Mark read
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={clearAll}
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                </div>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                  <div className="px-3 py-6 text-sm text-muted-foreground text-center">
                    No notifications
                  </div>
                ) : (
                  <ScrollArea className="max-h-64">
                    {notifications.map((n) => {
                      const Icon = notificationIcon[n.type]
                      return (
                        <div
                          key={n.id}
                          className={cn(
                            'flex gap-3 px-3 py-2 text-sm',
                            !n.read && 'bg-muted/50'
                          )}
                        >
                          <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', notificationColor[n.type])} />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground">{n.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-3">{n.body}</p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {new Date(n.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </ScrollArea>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
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
