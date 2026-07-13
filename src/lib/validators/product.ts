import { z } from 'zod'

export const productCreateSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200),
  barcode: z.string().max(50).nullable().optional(),
  plu_code: z.string().max(20).nullable().optional(),
  category_id: z.string().uuid('Invalid category'),
  supplier_id: z.string().uuid().nullable().optional(),
  branch_id: z.string().uuid('Invalid branch'),
  is_weighed: z.boolean().default(false),
  cost_price: z.number().min(0, 'Cost price must be ≥ 0'),
  selling_price: z.number().min(0, 'Selling price must be ≥ 0'),
  vat_rate: z.number().min(0).max(100).default(16.00),
  reorder_level: z.number().int().min(0).default(5),
  description: z.string().max(500).nullable().optional(),
  initial_stock: z.number().min(0).default(0),
})

export type ProductCreateInput = z.infer<typeof productCreateSchema>

export const productUpdateSchema = productCreateSchema.partial().omit({ branch_id: true, initial_stock: true })

export type ProductUpdateInput = z.infer<typeof productUpdateSchema>

export const categoryCreateSchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  description: z.string().max(300).nullable().optional(),
})

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>

export const supplierCreateSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').max(200),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().max(500).nullable().optional(),
})

export type SupplierCreateInput = z.infer<typeof supplierCreateSchema>
