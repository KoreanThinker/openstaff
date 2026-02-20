import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AppShell } from '@/components/AppShell'
import { SetupWizard } from '@/pages/SetupWizard'
import { Dashboard } from '@/pages/Dashboard'
import { StaffCreate } from '@/pages/StaffCreate'
import { StaffDetail } from '@/pages/StaffDetail'
import { Skills } from '@/pages/Skills'
import { Agents } from '@/pages/Agents'
import { Registry } from '@/pages/Registry'
import { Settings } from '@/pages/Settings'
import { useSettingsStore } from '@/stores/settings-store'
import { Toaster } from '@/components/ui/toaster'
import { api } from '@/lib/api'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
})

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
          <SetupWizard />
          <Toaster />
        </QueryClientProvider>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
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
          <Toaster />
        </HashRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
