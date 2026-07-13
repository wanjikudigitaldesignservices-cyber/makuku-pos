import Dexie, { type Table } from 'dexie'
import type { ProcessSaleInput } from '@/lib/validators/sale'

export interface PendingSale {
  id?: number
  idempotency_key: string
  payload: ProcessSaleInput
  created_at: string
  status: 'pending' | 'syncing' | 'failed'
  error?: string
  retry_count: number
}

export class MakukuLocalDB extends Dexie {
  pendingSales!: Table<PendingSale, number>

  constructor() {
    super('MakukuPOS')
    
    // Define schema
    this.version(1).stores({
      pendingSales: '++id, idempotency_key, status, created_at'
    })
  }
}

export const localDb = new MakukuLocalDB()
