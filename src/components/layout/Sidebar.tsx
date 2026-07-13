import { NavLink } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { useShiftStore } from '@/stores/shift.store'
import {
  ShoppingCart,
  Package,
  Clock,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Store,
  Layers,
  Truck,
  AlertTriangle,
} from 'lucide-react'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  permission?: string
}

const navItems: NavItem[] = [
  { label: 'Checkout', path: '/checkout', icon: <ShoppingCart className="h-5 w-5" /> },
  { label: 'Shift', path: '/shift', icon: <Clock className="h-5 w-5" /> },
  { label: 'Products', path: '/products', icon: <Package className="h-5 w-5" />, permission: 'inventory:view' },
  { label: 'Categories', path: '/categories', icon: <Layers className="h-5 w-5" />, permission: 'settings:categories' },
  { label: 'Suppliers', path: '/suppliers', icon: <Truck className="h-5 w-5" />, permission: 'settings:suppliers' },
  { label: 'Stock Alerts', path: '/low-stock', icon: <AlertTriangle className="h-5 w-5" />, permission: 'inventory:view' },
  { label: 'Reports', path: '/reports', icon: <BarChart3 className="h-5 w-5" />, permission: 'reports:daily_sales' },
  { label: 'Staff', path: '/staff', icon: <Users className="h-5 w-5" />, permission: 'staff:view' },
  { label: 'Settings', path: '/settings', icon: <Settings className="h-5 w-5" />, permission: 'settings:branches' },
]

export function Sidebar() {
  const { staff, canAccess, logout } = useAuthStore()
  const { activeShift, activeTill } = useShiftStore()

  const filteredNavItems = navItems.filter((item) => {
    if (!item.permission) return true
    return canAccess(item.permission as never)
  })

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
          <Store className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-base font-bold text-sidebar-foreground tracking-tight">Makuku</h1>
          <p className="text-xs text-muted-foreground">Supermarket POS</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {filteredNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
              }`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Shift & User Info Footer */}
      <div className="border-t border-sidebar-border p-4 space-y-3">
        {/* Active Shift */}
        {activeShift && (
          <div className="rounded-lg bg-sidebar-accent/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">Active Shift</p>
            <p className="text-sm font-medium text-sidebar-foreground">
              {activeTill?.name || 'Till'}
            </p>
          </div>
        )}

        {/* Current Staff */}
        {staff && (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary text-sm font-bold">
              {staff.full_name.split(' ').map(n => n[0]).join('').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {staff.full_name}
              </p>
              <p className="text-xs text-muted-foreground capitalize">{staff.role}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
