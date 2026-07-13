import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Session } from '@supabase/supabase-js'
import type { Staff } from '@/types/database'
import type { Role, Permission } from '@/constants/roles'
import { hasPermission } from '@/constants/roles'
import { supabase } from '@/lib/supabase'

interface AuthState {
  // Session state
  session: Session | null
  staff: Staff | null
  isLoading: boolean
  isAuthenticated: boolean
  
  // Actions
  setSession: (session: Session | null) => void
  setStaff: (staff: Staff | null) => void
  setLoading: (loading: boolean) => void
  
  // Auth operations
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  switchCashier: (staffId: string) => void
  
  // Permission checks
  hasRole: (role: Role) => boolean
  canAccess: (permission: Permission) => boolean
  
  // Hydration
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      staff: null,
      isLoading: true,
      isAuthenticated: false,

      setSession: (session) =>
        set({ session, isAuthenticated: !!session }),
      
      setStaff: (staff) => set({ staff }),
      
      setLoading: (isLoading) => set({ isLoading }),

      login: async (email: string, password: string) => {
        set({ isLoading: true })
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          })
          if (error) throw error

          // Fetch staff record
          const { data: staffData, error: staffError } = await supabase
            .from('staff')
            .select('*')
            .eq('id', data.user.id)
            .single()

          if (staffError) throw new Error('Staff record not found. Contact admin.')

          set({
            session: data.session,
            staff: staffData as Staff,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: async () => {
        await supabase.auth.signOut()
        set({
          session: null,
          staff: null,
          isAuthenticated: false,
        })
      },

      switchCashier: (staffId: string) => {
        // PIN-based cashier switch — updates active staff context
        // This doesn't change the Supabase auth session, just the active cashier
        const fetchStaff = async () => {
          const { data, error } = await supabase
            .from('staff')
            .select('*')
            .eq('id', staffId)
            .single()
          if (!error && data) {
            set({ staff: data as Staff })
          }
        }
        fetchStaff()
      },

      hasRole: (role: Role) => {
        const { staff } = get()
        if (!staff) return false
        if (role === 'cashier') return true // all roles include cashier permissions
        if (role === 'manager') return staff.role === 'manager' || staff.role === 'admin'
        return staff.role === role
      },

      canAccess: (permission: Permission) => {
        const { staff } = get()
        if (!staff) return false
        return hasPermission(staff.role, permission)
      },

      initialize: async () => {
        set({ isLoading: true })
        try {
          const { data: { session } } = await supabase.auth.getSession()
          
          if (session?.user) {
            const { data: staffData } = await supabase
              .from('staff')
              .select('*')
              .eq('id', session.user.id)
              .single()

            set({
              session,
              staff: staffData as Staff | null,
              isAuthenticated: true,
              isLoading: false,
            })
          } else {
            set({ isLoading: false })
          }

          // Listen for auth state changes
          supabase.auth.onAuthStateChange((_event, session) => {
            set({ session, isAuthenticated: !!session })
            if (!session) {
              set({ staff: null })
            }
          })
        } catch {
          set({ isLoading: false })
        }
      },
    }),
    {
      name: 'makuku-auth',
      partialize: (state) => ({
        // Only persist staff info, not session (Supabase handles that)
        staff: state.staff,
      }),
    }
  )
)
