import { useState, useRef, useEffect } from 'react'
import { getProductByBarcode } from '@/services/product.service'
import { useAuthStore } from '@/stores/auth.store'
import { useCartStore } from '@/stores/cart.store'
import { Search, Loader2, ScanBarcode } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function BarcodeInput() {
  const [barcode, setBarcode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { staff } = useAuthStore()
  const addItem = useCartStore((s) => s.addItem)
  const addWeighedItem = useCartStore((s) => s.addWeighedItem)

  // Keep focus on the barcode input naturally for a POS system
  useEffect(() => {
    const focusInput = () => {
      // Don't steal focus if user is typing in another input (like a dialog)
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return
      }
      inputRef.current?.focus()
    }
    
    // Auto-focus on mount
    focusInput()

    // Re-focus when clicking outside
    document.addEventListener('click', focusInput)
    return () => document.removeEventListener('click', focusInput)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!barcode.trim() || !staff?.branch_id) return

    setIsLoading(true)
    setError('')

    try {
      // Check if it's a weight barcode (starts with 2, typical deli scale format)
      // e.g. 210010001509 -> 2 (prefix), 1001 (PLU), 00150 (Weight in grams), 9 (Check)
      let actualBarcode = barcode
      let extractedWeightKg: number | null = null

      if (barcode.length >= 12 && barcode.startsWith('2')) {
        const plu = barcode.substring(1, 6).replace(/^0+/, '')
        const weightGrams = parseInt(barcode.substring(6, 11), 10)
        actualBarcode = plu
        extractedWeightKg = weightGrams / 1000
      }

      const product = await getProductByBarcode(actualBarcode, staff.branch_id)

      if (!product) {
        setError('Product not found')
        return
      }

      if (product.is_weighed && extractedWeightKg !== null) {
        addWeighedItem(product, extractedWeightKg)
      } else if (product.is_weighed) {
        // Here we'd typically open a modal to ask for manual weight if scale integration is present
        setError('Weighed item requires weight (e.g. scale scale input)')
        // For MVP, we might just prompt or assume 1kg if testing, but let's be strict
      } else {
        addItem(product, 1)
      }

      setBarcode('')
    } catch (err) {
      setError('Error looking up product')
    } finally {
      setIsLoading(false)
      // Keep focus after submission
      inputRef.current?.focus()
    }
  }

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="flex gap-2 relative">
        <div className="relative flex-1">
          <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Scan barcode or type PLU... (Press Enter)"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            className="pl-10 h-14 text-lg font-mono shadow-sm bg-background border-border focus:ring-primary/50"
            disabled={isLoading}
            autoComplete="off"
          />
        </div>
        <Button 
          type="submit" 
          disabled={isLoading || !barcode} 
          className="h-14 px-8"
        >
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
        </Button>
      </form>
      {error && (
        <div className="absolute top-full mt-2 w-full text-center text-sm font-medium text-destructive bg-destructive/10 rounded-md py-1 border border-destructive/20 shadow-sm animate-fade-in z-10">
          {error}
        </div>
      )}
    </div>
  )
}
