import { useCartStore } from '@/stores/cart.store'
import { formatKES } from '@/constants/payment-methods'
import { Minus, Plus, Trash2, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CartList() {
  const { items, updateQuantity, removeItem, setLineDiscount } = useCartStore()

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
        <div className="w-24 h-24 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
          <ShoppingCartIcon className="h-10 w-10 opacity-20" />
        </div>
        <p className="text-lg font-medium">Cart is empty</p>
        <p className="text-sm opacity-70">Scan an item to begin</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
      {items.map((item, index) => (
        <div 
          key={`${item.product_id}-${index}`}
          className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow group animate-fade-in"
        >
          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-foreground truncate">{item.product_name}</h4>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
              <span>{item.barcode || 'No barcode'}</span>
              <span>•</span>
              <span className="font-mono">{formatKES(item.unit_price)} {item.is_weighed ? '/ kg' : ''}</span>
              {item.discount_amount > 0 && (
                <>
                  <span>•</span>
                  <span className="text-success flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    -{formatKES(item.discount_amount)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Quantity Controls */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {item.is_weighed ? (
              <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-1.5 border border-border">
                <span className="font-mono font-medium">{item.quantity.toFixed(3)} kg</span>
              </div>
            ) : (
              <div className="flex items-center bg-secondary/50 rounded-lg border border-border p-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-md hover:bg-background"
                  onClick={() => updateQuantity(index, item.quantity - 1)}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="w-12 text-center font-mono font-medium">{item.quantity}</div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-md hover:bg-background"
                  onClick={() => updateQuantity(index, item.quantity + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Price & Delete */}
          <div className="flex items-center justify-end gap-3 min-w-[120px]">
            <div className="text-right">
              <div className="font-bold text-lg">{formatKES(item.line_total)}</div>
              {item.discount_amount > 0 && (
                <div className="text-xs text-muted-foreground line-through">
                  {formatKES(item.quantity * item.unit_price)}
                </div>
              )}
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => removeItem(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function ShoppingCartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  )
}
