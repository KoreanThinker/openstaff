import { create } from 'zustand'

interface SidebarStore {
  expanded: boolean
  mobileOpen: boolean
  toggle: () => void
  setMobileOpen: (open: boolean) => void
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  expanded: localStorage.getItem('sidebar_expanded') !== 'false',
  mobileOpen: false,

  toggle: () =>
    set((state) => {
      const next = !state.expanded
      localStorage.setItem('sidebar_expanded', String(next))
      return { expanded: next }
    }),

  setMobileOpen: (open) => set({ mobileOpen: open })
}))
