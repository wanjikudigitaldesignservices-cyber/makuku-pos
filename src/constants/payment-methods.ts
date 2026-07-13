export const PAYMENT_METHODS = {
  CASH: 'cash',
  MPESA: 'mpesa',
  CARD: 'card',
} as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  mpesa: 'M-Pesa',
  card: 'Card',
}

export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, string> = {
  cash: '💵',
  mpesa: '📱',
  card: '💳',
}

export const SALE_STATUSES = {
  COMPLETED: 'completed',
  VOIDED: 'voided',
  REFUNDED: 'refunded',
} as const

export const PAYMENT_STATUSES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
} as const

/** Kenya standard VAT rate */
export const DEFAULT_VAT_RATE = 16.00

/** Calculate VAT from a VAT-inclusive price */
export function calculateVat(inclusiveAmount: number, vatRate: number = DEFAULT_VAT_RATE): number {
  return Number((inclusiveAmount * vatRate / (100 + vatRate)).toFixed(2))
}

/** Calculate exclusive price from a VAT-inclusive price */
export function calculateExclusivePrice(inclusivePrice: number, vatRate: number = DEFAULT_VAT_RATE): number {
  return Number((inclusivePrice * 100 / (100 + vatRate)).toFixed(2))
}

/** Format amount as KES */
export function formatKES(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
