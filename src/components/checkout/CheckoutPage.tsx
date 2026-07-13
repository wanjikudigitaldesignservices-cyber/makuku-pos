import { useState } from 'react'
import { BarcodeInput } from './BarcodeInput'
import { CartList } from './CartList'
import { PaymentPanel } from './PaymentPanel'
import { useShiftStore } from '@/stores/shift.store'
import { useAuthStore } from '@/stores/auth.store'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Printer, ArrowRight } from 'lucide-react'
import { Navigate } from 'react-router-dom'

export function CheckoutPage() {
  const { isShiftOpen, activeTill } = useShiftStore()
  const { staff } = useAuthStore()
  
  const [completedSaleId, setCompletedSaleId] = useState<string | null>(null)

  // Wait for shift
  if (!isShiftOpen) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-background">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 bg-warning/20 text-warning rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold">Shift Closed</h2>
          <p className="text-muted-foreground">
            You need to open a shift on this till before you can process sales.
          </p>
          <Button className="w-full" size="lg" asChild>
            <a href="/shift">Open Shift</a>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* Left side: Cart & Input */}
      <div className="flex-1 flex flex-col h-full min-w-[60%]">
        {/* Top Bar */}
        <div className="h-16 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight">Checkout</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              {activeTill?.name}
            </span>
          </div>
          <div className="text-sm font-medium text-muted-foreground">
            Cashier: {staff?.full_name}
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-background shrink-0 border-b border-border">
          <BarcodeInput />
        </div>

        {/* Cart items */}
        <CartList />
      </div>

      {/* Right side: Payment Panel */}
      <div className="w-96 shrink-0 h-full border-l border-border bg-card">
        <PaymentPanel onSaleComplete={(saleId) => setCompletedSaleId(saleId)} />
      </div>

      {/* Sale Complete Modal */}
      <Dialog open={!!completedSaleId} onOpenChange={(o) => !o && setCompletedSaleId(null)}>
        <DialogContent className="sm:max-w-[400px]" onClose={() => setCompletedSaleId(null)}>
          <div className="py-6 text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-success/20 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight">Sale Completed!</h2>
              <p className="text-sm text-muted-foreground">Transaction ID: {completedSaleId?.split('-')[0]}</p>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <Button size="lg" className="w-full h-14 text-base" onClick={() => setCompletedSaleId(null)}>
                <ArrowRight className="h-5 w-5 mr-2" />
                Next Customer
              </Button>
              <Button size="lg" variant="outline" className="w-full h-14 text-base">
                <Printer className="h-5 w-5 mr-2" />
                Print Receipt
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
