import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
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

  if (!setupCompleted) {
    return (
      <QueryClientProvider client={queryClient}>
        <SetupWizard />
        <Toaster />
      </QueryClientProvider>
    )
  }

  return (
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
  )
}
