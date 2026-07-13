export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CASHIER: 'cashier',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

/**
 * Permissions matrix — defines what each role can access
 */
export const PERMISSIONS = {
  // Checkout
  'checkout:sell': ['admin', 'manager', 'cashier'],
  'checkout:void_line': ['admin', 'manager'],
  'checkout:apply_discount': ['admin', 'manager'],
  'checkout:hold_sale': ['admin', 'manager', 'cashier'],

  // Inventory
  'inventory:view': ['admin', 'manager', 'cashier'],
  'inventory:create': ['admin', 'manager'],
  'inventory:edit': ['admin', 'manager'],
  'inventory:delete': ['admin'],
  'inventory:goods_received': ['admin', 'manager'],
  'inventory:stock_adjust': ['admin', 'manager'],

  // Shifts
  'shift:open': ['admin', 'manager', 'cashier'],
  'shift:close': ['admin', 'manager', 'cashier'],
  'shift:view_all': ['admin', 'manager'],

  // Reports
  'reports:daily_sales': ['admin', 'manager'],
  'reports:cashier_performance': ['admin', 'manager'],
  'reports:stock_valuation': ['admin', 'manager'],

  // Staff management
  'staff:view': ['admin', 'manager'],
  'staff:create': ['admin'],
  'staff:edit': ['admin'],
  'staff:delete': ['admin'],

  // Settings
  'settings:branches': ['admin'],
  'settings:tills': ['admin'],
  'settings:categories': ['admin', 'manager'],
  'settings:suppliers': ['admin', 'manager'],
} as const

export type Permission = keyof typeof PERMISSIONS

/**
 * Check if a role has a given permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission]
  return (allowedRoles as readonly string[]).includes(role)
}
