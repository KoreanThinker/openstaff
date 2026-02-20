import { create } from 'zustand'

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // localStorage may be unavailable or full
  }
}

interface SettingsStore {
  setupCompleted: boolean
  theme: 'light' | 'dark' | 'system'
  setSetupCompleted: (completed: boolean) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  setupCompleted: safeGetItem('setup_completed') === 'true',
  theme: (safeGetItem('theme') as 'light' | 'dark' | 'system') || 'system',

  setSetupCompleted: (completed) => {
    safeSetItem('setup_completed', String(completed))
    set({ setupCompleted: completed })
  },

  setTheme: (theme) => {
    safeSetItem('theme', theme)
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.add(isDark ? 'dark' : 'light')
    } else {
      root.classList.add(theme)
    }
    set({ theme })
  }
}))
