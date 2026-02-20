import { create } from 'zustand'

export interface AppNotification {
  id: string
  title: string
  body: string
  type: 'error' | 'warning' | 'info'
  timestamp: number
  read: boolean
}

interface NotificationStore {
  notifications: AppNotification[]
  unreadCount: number
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void
  markAllRead: () => void
  clearAll: () => void
}

let nextId = 0

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  unreadCount: 0,
  addNotification: (notification) => {
    const entry: AppNotification = {
      ...notification,
      id: String(++nextId),
      timestamp: Date.now(),
      read: false
    }
    set((state) => ({
      notifications: [entry, ...state.notifications].slice(0, 50),
      unreadCount: state.unreadCount + 1
    }))
  },
  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0
    })),
  clearAll: () => set({ notifications: [], unreadCount: 0 })
}))
