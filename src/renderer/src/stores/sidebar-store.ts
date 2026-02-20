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

interface SidebarStore {
  expanded: boolean
  mobileOpen: boolean
  toggle: () => void
  setMobileOpen: (open: boolean) => void
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  expanded: safeGetItem('sidebar_expanded') !== 'false',
  mobileOpen: false,

  toggle: () =>
    set((state) => {
      const next = !state.expanded
      safeSetItem('sidebar_expanded', String(next))
      return { expanded: next }
    }),

  setMobileOpen: (open) => set({ mobileOpen: open })
}))
