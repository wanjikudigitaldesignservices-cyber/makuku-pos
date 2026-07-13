import { useState, useEffect } from 'react'
import { createProduct, getCategories, getSuppliers } from '@/services/product.service'
import { productCreateSchema } from '@/lib/validators/product'
import { useAuthStore } from '@/stores/auth.store'
import type { Category, Supplier } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Save, X, Loader2 } from 'lucide-react'

export function ProductForm({ onSuccess, onCancel }: { onSuccess: () => void, onCancel: () => void }) {
  const { staff } = useAuthStore()
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Form State
  const [name, setName] = useState('')
  const [barcode, setBarcode] = useState('')
  const [pluCode, setPluCode] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [isWeighed, setIsWeighed] = useState(false)
  const [costPrice, setCostPrice] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [vatRate, setVatRate] = useState('16')
  const [reorderLevel, setReorderLevel] = useState('5')
  const [initialStock, setInitialStock] = useState('0')

  useEffect(() => {
    async function loadRefs() {
      try {
        const [cats, sups] = await Promise.all([getCategories(), getSuppliers()])
        setCategories(cats)
        setSuppliers(sups)
      } catch (err) {
        console.error('Failed to load references', err)
      }
    }
    loadRefs()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!staff?.branch_id) return
    setError('')
    setIsLoading(true)

    try {
      const input = {
        name,
        barcode: barcode || null,
        plu_code: pluCode || null,
        category_id: categoryId,
        supplier_id: supplierId || null,
        branch_id: staff.branch_id,
        is_weighed: isWeighed,
        cost_price: Number(costPrice),
        selling_price: Number(sellingPrice),
        vat_rate: Number(vatRate),
        reorder_level: Number(reorderLevel),
        initial_stock: Number(initialStock)
      }

      const validated = productCreateSchema.parse(input)
      await createProduct(validated)
      onSuccess()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to create product. Check input validation.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Add New Product</CardTitle>
          <CardDescription>Create a new product in the inventory catalog</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Product Name *</label>
              <Input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ndovu Wheat Flour 2kg" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Barcode (optional)</label>
              <Input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Scan or type" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">PLU Code (optional)</label>
              <Input value={pluCode} onChange={e => setPluCode(e.target.value)} placeholder="e.g. 1001" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Category *</label>
              <select 
                required 
                value={categoryId} 
                onChange={e => setCategoryId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring"
              >
                <option value="">Select a category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Supplier (optional)</label>
              <select 
                value={supplierId} 
                onChange={e => setSupplierId(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring"
              >
                <option value="">Select a supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Cost Price (KES) *</label>
              <Input required type="number" step="0.01" min="0" value={costPrice} onChange={e => setCostPrice(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Selling Price (KES) *</label>
              <Input required type="number" step="0.01" min="0" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">VAT Rate (%)</label>
              <Input required type="number" step="1" min="0" max="100" value={vatRate} onChange={e => setVatRate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Initial Stock</label>
              <Input type="number" min="0" value={initialStock} onChange={e => setInitialStock(e.target.value)} />
            </div>

            <div className="space-y-2 md:col-span-2 flex items-center gap-2 mt-2">
              <input 
                type="checkbox" 
                id="isWeighed" 
                checked={isWeighed} 
                onChange={e => setIsWeighed(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <label htmlFor="isWeighed" className="text-sm font-medium cursor-pointer">
                Is Weighed Item (e.g. Fruits, Vegetables)
              </label>
            </div>
          </div>
        </CardContent>

        <CardFooter className="justify-end gap-3 border-t border-border pt-6">
          <Button type="button" variant="ghost" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading || !categoryId || !name}>
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Product
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
