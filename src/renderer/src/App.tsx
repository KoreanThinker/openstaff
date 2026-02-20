import { lazy, Suspense, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useSettingsStore } from '@/stores/settings-store'
import { Toaster } from '@/components/ui/toaster'
import { api } from '@/lib/api'

const AppShell = lazy(() => import('@/components/AppShell').then((m) => ({ default: m.AppShell })))
const SetupWizard = lazy(() => import('@/pages/SetupWizard').then((m) => ({ default: m.SetupWizard })))
const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const StaffCreate = lazy(() => import('@/pages/StaffCreate').then((m) => ({ default: m.StaffCreate })))
const StaffDetail = lazy(() => import('@/pages/StaffDetail').then((m) => ({ default: m.StaffDetail })))
const Skills = lazy(() => import('@/pages/Skills').then((m) => ({ default: m.Skills })))
const Agents = lazy(() => import('@/pages/Agents').then((m) => ({ default: m.Agents })))
const Registry = lazy(() => import('@/pages/Registry').then((m) => ({ default: m.Registry })))
const Settings = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.Settings })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
})

function RouteFallback(): React.ReactElement {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}

export function App(): React.ReactElement {
  const setupCompleted = useSettingsStore((s) => s.setupCompleted)
  const setSetupCompleted = useSettingsStore((s) => s.setSetupCompleted)
  const theme = useSettingsStore((s) => s.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)

  // Sync setup_completed from API on mount (source of truth is config.json)
  useEffect(() => {
    api.getSettings()
      .then((data) => {
        if (data.setup_completed === true) setSetupCompleted(true)
      })
      .catch(() => { /* API not ready yet */ })
  }, [setSetupCompleted])

  // Apply theme on mount and when it changes
  useEffect(() => {
    setTheme(theme)

    // Listen for OS theme changes when using 'system' mode
    if (theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (): void => setTheme('system')
      media.addEventListener('change', handler)
      return () => media.removeEventListener('change', handler)
    }
  }, [theme, setTheme])

  if (!setupCompleted) {
    return (
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={<RouteFallback />}>
            <SetupWizard />
          </Suspense>
          <Toaster />
        </QueryClientProvider>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/staffs/new" element={<StaffCreate />} />
                <Route path="/staffs/:id" element={<StaffDetail />} />
                <Route path="/staffs/:id/edit" element={<StaffCreate />} />
                <Route path="/skills" element={<Skills />} />
                <Route path="/agents" element={<Agents />} />
                <Route path="/registry" element={<Registry />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <Toaster />
        </HashRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
