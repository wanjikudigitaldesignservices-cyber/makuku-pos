import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Shift, Till } from '@/types/database'
import { supabase } from '@/lib/supabase'

interface ShiftState {
  activeShift: Shift | null
  activeTill: Till | null
  isShiftOpen: boolean

  // Actions
  openShift: (tillId: string, cashierId: string, branchId: string, openingFloat: number) => Promise<Shift>
  closeShift: (countedCash: number) => Promise<unknown>
  setActiveShift: (shift: Shift | null) => void
  setActiveTill: (till: Till | null) => void
  
  // Queries
  checkOpenShift: (cashierId: string) => Promise<Shift | null>
}

export const useShiftStore = create<ShiftState>()(
  persist(
    (set, get) => ({
      activeShift: null,
      activeTill: null,
      isShiftOpen: false,

      setActiveShift: (shift) =>
        set({ activeShift: shift, isShiftOpen: !!shift && shift.status === 'open' }),

      setActiveTill: (till) => set({ activeTill: till }),

      openShift: async (tillId, cashierId, branchId, openingFloat) => {
        const { data, error } = await supabase
          .from('shifts')
          .insert({
            till_id: tillId,
            cashier_id: cashierId,
            branch_id: branchId,
            opening_float: openingFloat,
            status: 'open',
          })
          .select()
          .single()

        if (error) throw error

        // Fetch the till info
        const { data: tillData } = await supabase
          .from('tills')
          .select('*')
          .eq('id', tillId)
          .single()

        const shift = data as Shift
        set({
          activeShift: shift,
          activeTill: tillData as Till,
          isShiftOpen: true,
        })
        return shift
      },

      closeShift: async (countedCash: number) => {
        const { activeShift } = get()
        if (!activeShift) throw new Error('No active shift')

        const { data, error } = await supabase.rpc('close_shift', {
          p_shift_id: activeShift.id,
          p_counted_cash: countedCash,
        })

        if (error) throw error

        set({
          activeShift: null,
          activeTill: null,
          isShiftOpen: false,
        })

        return data
      },

      checkOpenShift: async (cashierId: string) => {
        const { data, error } = await supabase
          .from('shifts')
          .select('*, tills(*)')
          .eq('cashier_id', cashierId)
          .eq('status', 'open')
          .order('opened_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (error || !data) return null

        const shift = data as Shift & { tills: Till }
        set({
          activeShift: shift,
          activeTill: shift.tills || null,
          isShiftOpen: true,
        })
        return shift
      },
    }),
    {
      name: 'makuku-shift',
      partialize: (state) => ({
        activeShift: state.activeShift,
        activeTill: state.activeTill,
        isShiftOpen: state.isShiftOpen,
      }),
    }
  )
)
