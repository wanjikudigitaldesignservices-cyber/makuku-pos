import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import type { Permission } from '@/constants/roles'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  permission?: Permission
}

export function ProtectedRoute({ permission }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, canAccess } = useAuthStore()

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (permission && !canAccess(permission)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />
}
