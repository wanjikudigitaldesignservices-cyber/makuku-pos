import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { useOfflineStore } from '@/stores/offline.store'

// Layouts & Auth
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/components/auth/LoginPage'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

// Pages
import { ProductsPage } from '@/components/products/ProductsPage'
import { CheckoutPage } from '@/components/checkout/CheckoutPage'
import { ShiftPage } from '@/components/shift/ShiftPage'
import { ReportsPage } from '@/components/reports/ReportsPage'
const Dashboard = () => <div className="p-6">Dashboard</div>
const Unauthorized = () => <div className="p-6 text-destructive">Unauthorized Access</div>

export function App() {
  const initializeAuth = useAuthStore((s) => s.initialize)
  const startOfflineMonitoring = useOfflineStore((s) => s.startMonitoring)

  useEffect(() => {
    initializeAuth()
    const cleanup = startOfflineMonitoring()
    return cleanup
  }, [initializeAuth, startOfflineMonitoring])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Protected App Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/checkout" replace />} />
            
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/shift" element={<ShiftPage />} />
            
            <Route element={<ProtectedRoute permission="inventory:view" />}>
              <Route path="/products" element={<ProductsPage />} />
            </Route>

            <Route element={<ProtectedRoute permission="reports:daily_sales" />}>
              <Route path="/reports" element={<ReportsPage />} />
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/checkout" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
