import { create } from 'zustand'
import { checkSupabaseConnection } from '@/lib/supabase'

export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'error'

interface OfflineState {
  isOnline: boolean
  syncStatus: SyncStatus
  pendingCount: number
  lastSyncAt: string | null
  syncError: string | null

  // Actions
  setOnline: (online: boolean) => void
  setSyncStatus: (status: SyncStatus) => void
  setPendingCount: (count: number) => void
  setSyncError: (error: string | null) => void
  markSynced: () => void

  // Initialization
  startMonitoring: () => () => void
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  isOnline: navigator.onLine,
  syncStatus: 'synced',
  pendingCount: 0,
  lastSyncAt: null,
  syncError: null,

  setOnline: (isOnline) => set({ isOnline }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setSyncError: (syncError) => set({ syncError }),
  markSynced: () =>
    set({
      syncStatus: 'synced',
      pendingCount: 0,
      lastSyncAt: new Date().toISOString(),
      syncError: null,
    }),

  startMonitoring: () => {
    const handleOnline = () => {
      set({ isOnline: true })
      // Trigger sync when coming back online
      if (get().pendingCount > 0) {
        set({ syncStatus: 'syncing' })
      }
    }
    
    const handleOffline = () => {
      set({ isOnline: false, syncStatus: 'pending' })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Also check Supabase connectivity periodically (every 30s)
    const checkInterval = setInterval(async () => {
      if (navigator.onLine) {
        const connected = await checkSupabaseConnection()
        if (!connected && get().isOnline) {
          set({ isOnline: false })
        } else if (connected && !get().isOnline) {
          handleOnline()
        }
      }
    }, 30000)

    // Cleanup function
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(checkInterval)
    }
  },
}))
