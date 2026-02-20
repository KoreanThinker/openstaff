import { create } from 'zustand'

interface SettingsStore {
  setupCompleted: boolean
  theme: 'light' | 'dark' | 'system'
  setSetupCompleted: (completed: boolean) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  setupCompleted: localStorage.getItem('setup_completed') === 'true',
  theme: (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system',

  setSetupCompleted: (completed) => {
    localStorage.setItem('setup_completed', String(completed))
    set({ setupCompleted: completed })
  },

  setTheme: (theme) => {
    localStorage.setItem('theme', theme)
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
