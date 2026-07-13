import { localDb } from '@/lib/db'
import { processSale } from '@/services/sales.service'
import { useOfflineStore } from '@/stores/offline.store'

// To prevent concurrent syncs
let isSyncing = false

export async function processSyncQueue() {
  const store = useOfflineStore.getState()
  
  if (!store.isOnline || isSyncing) return
  
  isSyncing = true
  store.setSyncStatus('syncing')

  try {
    // Get pending sales ordered by creation time
    const pendingSales = await localDb.pendingSales
      .where('status')
      .anyOf('pending', 'failed')
      .sortBy('created_at')

    if (pendingSales.length === 0) {
      store.markSynced()
      isSyncing = false
      return
    }

    store.setPendingCount(pendingSales.length)

    for (const pending of pendingSales) {
      // Skip if it has failed too many times, requires manual intervention
      if (pending.retry_count >= 5) continue

      try {
        // Mark as syncing
        await localDb.pendingSales.update(pending.id!, { status: 'syncing' })
        
        // Attempt to push to Supabase
        await processSale(pending.payload)
        
        // Success! Remove from local DB
        await localDb.pendingSales.delete(pending.id!)
        
        // Update count
        store.setPendingCount(await localDb.pendingSales.count())

      } catch (error) {
        // Failed to sync this particular record
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        await localDb.pendingSales.update(pending.id!, { 
          status: 'failed',
          error: errorMsg,
          retry_count: pending.retry_count + 1
        })
      }
    }

    // Check if any are still left
    const remaining = await localDb.pendingSales.count()
    if (remaining === 0) {
      store.markSynced()
    } else {
      store.setSyncStatus('error')
      store.setSyncError(`${remaining} sales failed to sync after retries.`)
    }

  } catch (error) {
    store.setSyncStatus('error')
    store.setSyncError(error instanceof Error ? error.message : 'Sync queue error')
  } finally {
    isSyncing = false
  }
}

/**
 * Queue a sale to be processed. If online, it attempts to process immediately.
 * If offline or if the immediate attempt fails (e.g. network drop), it stays in queue.
 */
export async function queueSale(payload: Parameters<typeof processSale>[0]) {
  const store = useOfflineStore.getState()
  const idempotencyKey = payload.idempotency_key || crypto.randomUUID()
  
  // Ensure the payload has the idempotency key
  const finalPayload = { ...payload, idempotency_key: idempotencyKey }

  // 1. Save to IndexedDB outbox
  await localDb.pendingSales.add({
    idempotency_key: idempotencyKey,
    payload: finalPayload,
    status: 'pending',
    created_at: new Date().toISOString(),
    retry_count: 0
  })

  store.setPendingCount(await localDb.pendingSales.count())

  // 2. Trigger sync asynchronously if we think we are online
  if (store.isOnline) {
    // Fire and forget
    processSyncQueue().catch(console.error)
  }
}
