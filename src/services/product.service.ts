import { supabase } from '@/lib/supabase'
import type { Product, ProductWithStock, Category, Supplier } from '@/types/database'
import { productCreateSchema, type ProductCreateInput, type ProductUpdateInput } from '@/lib/validators/product'

// ============================================================================
// PRODUCTS
// ============================================================================

export async function getProducts(options: {
  branchId: string
  categoryId?: string
  search?: string
  page?: number
  pageSize?: number
  activeOnly?: boolean
} = { branchId: '' }): Promise<{ data: ProductWithStock[]; count: number }> {
  const { branchId, categoryId, search, page = 1, pageSize = 50, activeOnly = true } = options
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('products')
    .select(`
      *,
      stock!inner(quantity, updated_at),
      category:categories(id, name),
      supplier:suppliers(id, name)
    `, { count: 'exact' })
    .eq('branch_id', branchId)
    .eq('stock.branch_id', branchId)
    .order('name')
    .range(from, to)

  if (activeOnly) {
    query = query.eq('active', true)
  }

  if (categoryId) {
    query = query.eq('category_id', categoryId)
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,barcode.eq.${search},plu_code.eq.${search}`)
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    data: (data || []) as unknown as ProductWithStock[],
    count: count || 0,
  }
}

export async function getProductByBarcode(barcode: string, branchId: string): Promise<ProductWithStock | null> {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      stock(quantity, updated_at),
      category:categories(id, name),
      supplier:suppliers(id, name)
    `)
    .eq('branch_id', branchId)
    .eq('active', true)
    .or(`barcode.eq.${barcode},plu_code.eq.${barcode}`)
    .maybeSingle()

  if (error) throw error
  return data as unknown as ProductWithStock | null
}

export async function getProductById(id: string): Promise<ProductWithStock | null> {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      stock(quantity, updated_at),
      category:categories(id, name),
      supplier:suppliers(id, name)
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data as unknown as ProductWithStock | null
}

export async function createProduct(input: ProductCreateInput): Promise<Product> {
  const validated = productCreateSchema.parse(input)
  const { initial_stock, ...productData } = validated

  // Insert product
  const { data: product, error } = await supabase
    .from('products')
    .insert(productData)
    .select()
    .single()

  if (error) throw error

  // Create initial stock record
  const { error: stockError } = await supabase
    .from('stock')
    .insert({
      product_id: product.id,
      branch_id: productData.branch_id,
      quantity: initial_stock || 0,
    })

  if (stockError) throw stockError

  // If initial stock > 0, create a stock movement
  if (initial_stock && initial_stock > 0) {
    await supabase.from('stock_movements').insert({
      product_id: product.id,
      branch_id: productData.branch_id,
      change: initial_stock,
      reason: 'adjustment',
      notes: 'Initial stock on product creation',
    })
  }

  return product as Product
}

export async function updateProduct(id: string, input: ProductUpdateInput): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Product
}

export async function deactivateProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ active: false })
    .eq('id', id)

  if (error) throw error
}

// ============================================================================
// CATEGORIES
// ============================================================================

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name')

  if (error) throw error
  return (data || []) as Category[]
}

export async function createCategory(name: string, description?: string): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ name, description: description || null })
    .select()
    .single()

  if (error) throw error
  return data as Category
}

export async function updateCategory(id: string, name: string, description?: string): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .update({ name, description: description || null })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Category
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}

// ============================================================================
// SUPPLIERS
// ============================================================================

export async function getSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('active', true)
    .order('name')

  if (error) throw error
  return (data || []) as Supplier[]
}

export async function createSupplier(input: { name: string; phone?: string; email?: string; address?: string }): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers')
    .insert(input)
    .select()
    .single()

  if (error) throw error
  return data as Supplier
}

export async function updateSupplier(id: string, input: Partial<Supplier>): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Supplier
}
