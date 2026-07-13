import { useOfflineStore } from '@/stores/offline.store'
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react'

export function OfflineIndicator() {
  const { isOnline, syncStatus, pendingCount } = useOfflineStore()

  if (isOnline && syncStatus === 'synced') return null

  return (
    <div className={`
      w-full px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium
      ${!isOnline 
        ? 'offline-bar text-white' 
        : syncStatus === 'syncing' 
          ? 'bg-warning/20 text-warning' 
          : syncStatus === 'error'
            ? 'bg-destructive/20 text-destructive'
            : 'bg-success/20 text-success'
      }
    `}>
      {!isOnline && (
        <>
          <WifiOff className="h-4 w-4" />
          <span>Offline Mode — Sales are saved locally</span>
          {pendingCount > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-white/20 text-xs">
              {pendingCount} pending
            </span>
          )}
        </>
      )}
      {isOnline && syncStatus === 'syncing' && (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Syncing {pendingCount} sale{pendingCount !== 1 ? 's' : ''}...</span>
        </>
      )}
      {isOnline && syncStatus === 'error' && (
        <>
          <WifiOff className="h-4 w-4" />
          <span>Sync error — Will retry automatically</span>
        </>
      )}
      {isOnline && syncStatus === 'synced' && pendingCount === 0 && (
        <>
          <CheckCircle2 className="h-4 w-4" />
          <span>All sales synced</span>
        </>
      )}
    </div>
  )
}
