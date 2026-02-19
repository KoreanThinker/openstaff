import { create } from 'zustand'
import type { ReactNode } from 'react'

interface HeaderActionStore {
  actionButton: ReactNode | null
  setActionButton: (button: ReactNode | null) => void
}

export const useHeaderActionStore = create<HeaderActionStore>((set) => ({
  actionButton: null,
  setActionButton: (button) => set({ actionButton: button })
}))
