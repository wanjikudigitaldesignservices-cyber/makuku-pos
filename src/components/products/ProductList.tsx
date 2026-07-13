import { useState, useEffect } from 'react'
import { getProducts, getCategories } from '@/services/product.service'
import { useAuthStore } from '@/stores/auth.store'
import type { ProductWithStock, Category } from '@/types/database'
import { formatKES } from '@/constants/payment-methods'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, Loader2, Edit, AlertCircle } from 'lucide-react'

export function ProductList({ onAddNew }: { onAddNew?: () => void }) {
  const { staff, canAccess } = useAuthStore()
  const [products, setProducts] = useState<ProductWithStock[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Filters
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')

  useEffect(() => {
    async function loadInitial() {
      try {
        const cats = await getCategories()
        setCategories(cats)
      } catch (err) {
        console.error('Failed to load categories', err)
      }
    }
    loadInitial()
  }, [])

  useEffect(() => {
    async function loadProducts() {
      if (!staff?.branch_id) return
      setIsLoading(true)
      try {
        const { data } = await getProducts({
          branchId: staff.branch_id,
          search: search || undefined,
          categoryId: selectedCategory || undefined,
          activeOnly: true,
        })
        setProducts(data)
      } catch (err) {
        console.error('Failed to load products', err)
      } finally {
        setIsLoading(false)
      }
    }

    // Debounce search slightly
    const timer = setTimeout(loadProducts, 300)
    return () => clearTimeout(timer)
  }, [staff?.branch_id, search, selectedCategory])

  const canEdit = canAccess('inventory:edit')
  const canCreate = canAccess('inventory:create')

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">Manage your branch inventory</p>
        </div>
        {canCreate && (
          <Button onClick={onAddNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, barcode, or PLU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="flex h-10 rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-48"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-3 font-medium">Product</th>
                  <th className="px-6 py-3 font-medium">Code/Barcode</th>
                  <th className="px-6 py-3 font-medium text-right">Price</th>
                  <th className="px-6 py-3 font-medium text-right">Stock</th>
                  <th className="px-6 py-3 font-medium text-center">Status</th>
                  {canEdit && <th className="px-6 py-3 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                      No products found.
                    </td>
                  </tr>
                ) : (
                  products.map((product) => {
                    // Provide a default empty array to handle missing stock gracefully during runtime
                    const stockItems = product.stock as unknown as { quantity: number }[] | undefined;
                    const qty = stockItems?.[0]?.quantity ?? 0;
                    const isLowStock = qty <= product.reorder_level

                    return (
                      <tr key={product.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-foreground">{product.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {((product.category as unknown as Category)?.name) || 'Uncategorized'}
                            {product.is_weighed && ' • Weighed'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                          {product.barcode || product.plu_code || '-'}
                        </td>
                        <td className="px-6 py-4 text-right font-medium">
                          {formatKES(product.selling_price)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isLowStock && <AlertCircle className="h-4 w-4 text-warning" />}
                            <span className={isLowStock ? 'text-warning font-medium' : ''}>
                              {qty}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Badge variant={qty > 0 ? 'success' : 'danger'}>
                            {qty > 0 ? 'In Stock' : 'Out of Stock'}
                          </Badge>
                        </td>
                        {canEdit && (
                          <td className="px-6 py-4 text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Edit className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
