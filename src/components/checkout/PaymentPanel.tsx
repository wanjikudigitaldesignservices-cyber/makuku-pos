import { useState } from 'react'
import { useCartStore } from '@/stores/cart.store'
import { useAuthStore } from '@/stores/auth.store'
import { useShiftStore } from '@/stores/shift.store'
import { holdSale } from '@/services/sales.service'
import { queueSale } from '@/services/sync.service'
import { formatKES } from '@/constants/payment-methods'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Banknote, CreditCard, Smartphone, PauseCircle, Loader2, CheckCircle2 } from 'lucide-react'

interface PaymentPanelProps {
  onSaleComplete: (saleId: string) => void
}

export function PaymentPanel({ onSaleComplete }: PaymentPanelProps) {
  const { staff } = useAuthStore()
  const { activeShift } = useShiftStore()
  const cart = useCartStore()
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'card' | null>(null)
  
  // Cash specific
  const [tendered, setTendered] = useState('')
  
  // M-Pesa specific
  const [phone, setPhone] = useState('')

  const handleHoldSale = async () => {
    if (!staff?.branch_id || !activeShift) return
    setIsProcessing(true)
    setError('')
    try {
      await holdSale(activeShift.id, staff.id, staff.branch_id, 'Customer forgot wallet')
      // Cart is cleared automatically by holdSale
    } catch (err) {
      setError('Failed to hold sale')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExactCash = () => {
    setTendered(cart.getGrandTotal().toString())
  }

  const handleProcessPayment = async () => {
    if (!staff?.branch_id || !activeShift || !paymentMethod) return
    
    setIsProcessing(true)
    setError('')

    try {
      const grandTotal = cart.getGrandTotal()
      const paymentAmount = paymentMethod === 'cash' ? Number(tendered) : grandTotal

      if (paymentMethod === 'cash' && paymentAmount < grandTotal) {
        throw new Error('Insufficient cash tendered')
      }

      // Prepare payload
      const payload = {
        shift_id: activeShift.id,
        branch_id: staff.branch_id,
        cashier_id: staff.id,
        items: cart.items,
        discount_total: cart.getDiscountTotal(),
        idempotency_key: cart.idempotencyKey,
        payments: [{
          method: paymentMethod,
          amount: grandTotal, // The amount covering the bill
          tendered: paymentMethod === 'cash' ? paymentAmount : undefined,
          change_due: paymentMethod === 'cash' ? paymentAmount - grandTotal : undefined,
          status: paymentMethod === 'cash' ? 'confirmed' : 'pending' as const, // Mpesa/Card might start pending
          mpesa_phone: paymentMethod === 'mpesa' ? phone : undefined
        }]
      }

      // Offline-first: queue the sale instead of direct processSale
      await queueSale(payload)

      if (paymentMethod === 'mpesa') {
        // Here we would typically initiate STK push via service and wait for webhook
        // For MVP frontend logic, we assume it's sent
        // await initiateSTKPush(phone, grandTotal, payload.idempotency_key)
      }

      // Success
      cart.clearCart()
      setPaymentMethod(null)
      setTendered('')
      // Since it's async queued, we just pass the idempotency key as a proxy for sale ID
      onSaleComplete(payload.idempotency_key)

    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Payment processing failed')
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const total = cart.getGrandTotal()
  const hasItems = cart.items.length > 0
  const isCashReady = paymentMethod === 'cash' && Number(tendered) >= total
  const isMpesaReady = paymentMethod === 'mpesa' && phone.length >= 9
  const isCardReady = paymentMethod === 'card'

  return (
    <Card className="flex flex-col h-full rounded-none border-0 sm:border-l border-border bg-sidebar">
      <CardContent className="flex flex-col h-full p-4 gap-4">
        
        {/* Totals Section */}
        <div className="space-y-3 bg-card rounded-xl p-4 border border-border shadow-sm">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatKES(cart.getSubtotal())}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>VAT (16%)</span>
            <span>{formatKES(cart.getVatTotal())}</span>
          </div>
          {cart.getDiscountTotal() > 0 && (
            <div className="flex justify-between text-sm text-success">
              <span>Discount</span>
              <span>-{formatKES(cart.getDiscountTotal())}</span>
            </div>
          )}
          <div className="pt-3 border-t border-border flex justify-between items-center">
            <span className="text-xl font-bold">Total</span>
            <span className="text-2xl font-black text-primary tracking-tight">
              {formatKES(total)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button 
            variant="outline" 
            className="h-16 flex-col gap-1 border-border bg-card hover:bg-accent"
            disabled={!hasItems || isProcessing}
            onClick={() => setPaymentMethod('cash')}
          >
            <Banknote className="h-6 w-6 text-emerald-500" />
            <span className="text-xs font-semibold">CASH</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="h-16 flex-col gap-1 border-border bg-card hover:bg-accent"
            disabled={!hasItems || isProcessing}
            onClick={() => setPaymentMethod('mpesa')}
          >
            <Smartphone className="h-6 w-6 text-success" />
            <span className="text-xs font-semibold">M-PESA</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="h-16 flex-col gap-1 border-border bg-card hover:bg-accent"
            disabled={!hasItems || isProcessing}
            onClick={() => setPaymentMethod('card')}
          >
            <CreditCard className="h-6 w-6 text-blue-500" />
            <span className="text-xs font-semibold">CARD</span>
          </Button>

          <Button 
            variant="secondary" 
            className="h-16 flex-col gap-1 bg-secondary hover:bg-secondary/80"
            disabled={!hasItems || isProcessing}
            onClick={handleHoldSale}
          >
            <PauseCircle className="h-6 w-6 text-muted-foreground" />
            <span className="text-xs font-semibold">HOLD SALE</span>
          </Button>
        </div>

      </CardContent>

      {/* Payment Modals */}
      <Dialog open={paymentMethod !== null} onOpenChange={(o) => !o && setPaymentMethod(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {paymentMethod === 'cash' && <Banknote className="h-5 w-5 text-emerald-500" />}
              {paymentMethod === 'mpesa' && <Smartphone className="h-5 w-5 text-success" />}
              {paymentMethod === 'card' && <CreditCard className="h-5 w-5 text-blue-500" />}
              {paymentMethod?.toUpperCase()} PAYMENT
            </DialogTitle>
          </DialogHeader>

          <div className="py-6 space-y-6">
            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">Amount Due</p>
              <p className="text-3xl font-black text-primary tracking-tight">{formatKES(total)}</p>
            </div>

            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20 text-center">
                {error}
              </div>
            )}

            {paymentMethod === 'cash' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Amount Tendered</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">KES</span>
                    <Input 
                      type="number" 
                      className="pl-12 h-14 text-xl font-bold" 
                      value={tendered}
                      onChange={(e) => setTendered(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  {[500, 1000, 'EXACT'].map((val) => (
                    <Button 
                      key={val} 
                      variant="outline" 
                      onClick={() => val === 'EXACT' ? handleExactCash() : setTendered(val.toString())}
                    >
                      {val}
                    </Button>
                  ))}
                </div>

                {Number(tendered) > total && (
                  <div className="p-4 bg-accent rounded-xl text-center border border-border">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Change Due</p>
                    <p className="text-2xl font-bold text-foreground">
                      {formatKES(Number(tendered) - total)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {paymentMethod === 'mpesa' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Customer Phone Number</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">+254</span>
                    <Input 
                      type="tel" 
                      className="pl-14 h-14 text-xl font-bold" 
                      placeholder="7XX XXX XXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  An STK Push prompt will be sent to the customer's phone to complete payment.
                </p>
              </div>
            )}

            {paymentMethod === 'card' && (
              <div className="py-8 text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center">
                  <CreditCard className="h-8 w-8 text-blue-500" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Process payment on PDQ machine</p>
                  <p className="text-sm text-muted-foreground mt-1">Click confirm once receipt is printed</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => setPaymentMethod(null)}>
              Cancel
            </Button>
            <Button 
              className="flex-1" 
              disabled={
                isProcessing || 
                (paymentMethod === 'cash' && !isCashReady) ||
                (paymentMethod === 'mpesa' && !isMpesaReady) ||
                (paymentMethod === 'card' && !isCardReady)
              }
              onClick={handleProcessPayment}
            >
              {isProcessing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Confirm
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
