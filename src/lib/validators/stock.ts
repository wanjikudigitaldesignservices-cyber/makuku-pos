import { z } from 'zod'

export const goodsReceivedItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive('Quantity must be > 0'),
  cost_price: z.number().min(0, 'Cost price must be ≥ 0'),
  update_cost_price: z.boolean().default(false),
})

export const goodsReceivedSchema = z.object({
  supplier_id: z.string().uuid('Supplier is required'),
  branch_id: z.string().uuid(),
  items: z.array(goodsReceivedItemSchema).min(1, 'At least one item required'),
  notes: z.string().max(500).optional(),
})

export type GoodsReceivedInput = z.infer<typeof goodsReceivedSchema>

export const stockAdjustmentSchema = z.object({
  product_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  quantity_change: z.number().refine(val => val !== 0, 'Adjustment cannot be zero'),
  reason: z.enum(['adjustment'], {
    required_error: 'Reason is required',
  }),
  notes: z.string().min(3, 'Please provide a reason for this adjustment').max(500),
})

export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>
