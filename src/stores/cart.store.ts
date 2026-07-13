import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { CartItem, HeldSaleItem, Product } from '@/types/database'
import { calculateVat } from '@/constants/payment-methods'

interface CartState {
  items: CartItem[]
  orderDiscount: number // flat amount discount on the whole order
  
  // Actions
  addItem: (product: Product, quantity?: number) => void
  removeItem: (index: number) => void
  updateQuantity: (index: number, quantity: number) => void
  setLineDiscount: (index: number, amount: number) => void
  setOrderDiscount: (amount: number) => void
  clearCart: () => void
  
  // Weighed items
  addWeighedItem: (product: Product, weightKg: number) => void
  
  // Hold/Resume
  getItemsForHold: () => HeldSaleItem[]
  loadFromHeld: (items: HeldSaleItem[]) => void
  
  // Computed
  getSubtotal: () => number
  getVatTotal: () => number
  getDiscountTotal: () => number
  getGrandTotal: () => number
  getItemCount: () => number
  
  // Idempotency
  idempotencyKey: string
  regenerateIdempotencyKey: () => void
}

function computeLineTotal(item: Omit<CartItem, 'line_total' | 'line_vat'>): CartItem {
  const lineTotal = Number((item.quantity * item.unit_price - item.discount_amount).toFixed(2))
  const lineVat = calculateVat(lineTotal, item.vat_rate)
  return { ...item, line_total: lineTotal, line_vat: lineVat }
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  orderDiscount: 0,
  idempotencyKey: uuidv4(),

  addItem: (product: Product, quantity = 1) => {
    const { items } = get()
    
    // Check if product already in cart (non-weighed only)
    const existingIndex = items.findIndex(
      (item) => item.product_id === product.id && !product.is_weighed
    )

    if (existingIndex >= 0) {
      // Increment quantity
      const updatedItems = [...items]
      const existing = updatedItems[existingIndex]
      updatedItems[existingIndex] = computeLineTotal({
        ...existing,
        quantity: existing.quantity + quantity,
      })
      set({ items: updatedItems })
    } else {
      // Add new item
      const newItem = computeLineTotal({
        product_id: product.id,
        product_name: product.name,
        barcode: product.barcode,
        quantity,
        unit_price: product.selling_price,
        vat_rate: product.vat_rate,
        is_weighed: product.is_weighed,
        discount_amount: 0,
      })
      set({ items: [...items, newItem] })
    }
  },

  addWeighedItem: (product: Product, weightKg: number) => {
    const newItem = computeLineTotal({
      product_id: product.id,
      product_name: product.name,
      barcode: product.barcode,
      quantity: weightKg,
      unit_price: product.selling_price,
      vat_rate: product.vat_rate,
      is_weighed: true,
      discount_amount: 0,
    })
    set({ items: [...get().items, newItem] })
  },

  removeItem: (index: number) => {
    set({ items: get().items.filter((_, i) => i !== index) })
  },

  updateQuantity: (index: number, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(index)
      return
    }
    const updatedItems = [...get().items]
    updatedItems[index] = computeLineTotal({
      ...updatedItems[index],
      quantity,
    })
    set({ items: updatedItems })
  },

  setLineDiscount: (index: number, amount: number) => {
    const updatedItems = [...get().items]
    updatedItems[index] = computeLineTotal({
      ...updatedItems[index],
      discount_amount: Math.max(0, amount),
    })
    set({ items: updatedItems })
  },

  setOrderDiscount: (amount: number) => {
    set({ orderDiscount: Math.max(0, amount) })
  },

  clearCart: () => {
    set({ items: [], orderDiscount: 0, idempotencyKey: uuidv4() })
  },

  getItemsForHold: () => {
    return get().items.map(({ product_id, product_name, barcode, quantity, unit_price, vat_rate, is_weighed, discount_amount }) => ({
      product_id,
      product_name,
      barcode,
      quantity,
      unit_price,
      vat_rate,
      is_weighed,
      discount_amount,
    }))
  },

  loadFromHeld: (items: HeldSaleItem[]) => {
    const cartItems = items.map((item) => computeLineTotal(item))
    set({ items: cartItems, orderDiscount: 0, idempotencyKey: uuidv4() })
  },

  getSubtotal: () => {
    return Number(get().items.reduce((sum, item) => sum + item.line_total, 0).toFixed(2))
  },

  getVatTotal: () => {
    return Number(get().items.reduce((sum, item) => sum + item.line_vat, 0).toFixed(2))
  },

  getDiscountTotal: () => {
    const lineDiscounts = get().items.reduce((sum, item) => sum + item.discount_amount, 0)
    return Number((lineDiscounts + get().orderDiscount).toFixed(2))
  },

  getGrandTotal: () => {
    const subtotal = get().getSubtotal()
    const orderDiscount = get().orderDiscount
    return Number(Math.max(0, subtotal - orderDiscount).toFixed(2))
  },

  getItemCount: () => {
    return get().items.reduce((sum, item) => sum + (item.is_weighed ? 1 : item.quantity), 0)
  },

  regenerateIdempotencyKey: () => {
    set({ idempotencyKey: uuidv4() })
  },
}))
