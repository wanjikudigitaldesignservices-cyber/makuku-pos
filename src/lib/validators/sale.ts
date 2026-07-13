import { z } from 'zod'

export const saleItemSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string().min(1),
  quantity: z.number().positive('Quantity must be > 0'),
  unit_price: z.number().min(0),
  discount_amount: z.number().min(0).default(0),
  vat_rate: z.number().min(0).max(100).default(16.00),
})

export const paymentSchema = z.object({
  method: z.enum(['cash', 'mpesa', 'card']),
  amount: z.number().positive('Payment amount must be > 0'),
  tendered: z.number().min(0).optional(),
  change_due: z.number().min(0).optional(),
  intasend_ref: z.string().optional(),
  mpesa_phone: z.string().regex(/^254\d{9}$/, 'Phone must be 254XXXXXXXXX format').optional(),
  status: z.enum(['pending', 'confirmed', 'failed']).optional(),
})

export const processSaleSchema = z.object({
  shift_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  cashier_id: z.string().uuid(),
  items: z.array(saleItemSchema).min(1, 'At least one item required'),
  payments: z.array(paymentSchema).min(1, 'At least one payment required'),
  discount_total: z.number().min(0).default(0),
  idempotency_key: z.string().uuid().optional(),
})

export type ProcessSaleInput = z.infer<typeof processSaleSchema>

export const voidSaleSchema = z.object({
  sale_id: z.string().uuid(),
  reason: z.string().min(3, 'Void reason is required'),
  manager_pin: z.string().min(4).max(6).regex(/^\d+$/),
})

export type VoidSaleInput = z.infer<typeof voidSaleSchema>

export const holdSaleSchema = z.object({
  shift_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    product_name: z.string(),
    barcode: z.string().nullable(),
    quantity: z.number().positive(),
    unit_price: z.number().min(0),
    vat_rate: z.number(),
    is_weighed: z.boolean(),
    discount_amount: z.number().min(0).default(0),
  })).min(1),
  note: z.string().max(200).optional(),
})

export type HoldSaleInput = z.infer<typeof holdSaleSchema>
