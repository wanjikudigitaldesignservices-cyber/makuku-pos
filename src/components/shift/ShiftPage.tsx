import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import { useShiftStore } from '@/stores/shift.store'
import { getTills, getXReport } from '@/services/shift.service'
import { formatKES } from '@/constants/payment-methods'
import type { Till, ShiftReport } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Clock, Loader2, RefreshCw, Printer } from 'lucide-react'

export function ShiftPage() {
  const { staff } = useAuthStore()
  const { activeShift, activeTill, isShiftOpen, openShift, closeShift } = useShiftStore()
  
  const [tills, setTills] = useState<Till[]>([])
  const [selectedTill, setSelectedTill] = useState<string>('')
  const [openingFloat, setOpeningFloat] = useState<string>('')
  const [countedCash, setCountedCash] = useState<string>('')
  const [report, setReport] = useState<ShiftReport | null>(null)
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Load tills and current report
  useEffect(() => {
    async function loadData() {
      if (!staff?.branch_id) return
      try {
        const branchTills = await getTills(staff.branch_id)
        setTills(branchTills)
        
        if (isShiftOpen && activeShift) {
          const xReport = await getXReport(activeShift.id)
          setReport(xReport)
        }
      } catch (err) {
        console.error('Failed to load shift data', err)
      }
    }
    loadData()
  }, [staff?.branch_id, isShiftOpen, activeShift])

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTill || !openingFloat || !staff?.branch_id) return
    
    setIsLoading(true)
    setError('')
    try {
      await openShift(selectedTill, staff.id, staff.branch_id, Number(openingFloat))
      setOpeningFloat('')
    } catch (err) {
      if (err instanceof Error) setError(err.message)
      else setError('Failed to open shift')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!countedCash) return
    
    setIsLoading(true)
    setError('')
    try {
      await closeShift(Number(countedCash))
      setCountedCash('')
      setReport(null)
    } catch (err) {
      if (err instanceof Error) setError(err.message)
      else setError('Failed to close shift')
    } finally {
      setIsLoading(false)
    }
  }

  const refreshReport = async () => {
    if (!activeShift) return
    setIsLoading(true)
    try {
      const xReport = await getXReport(activeShift.id)
      setReport(xReport)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isShiftOpen) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Open Shift
            </CardTitle>
            <CardDescription>Select a till and enter your opening float to start selling.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleOpenShift} className="space-y-4">
              {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</div>}
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Till</label>
                <select 
                  className="flex h-10 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring"
                  value={selectedTill}
                  onChange={e => setSelectedTill(e.target.value)}
                  required
                >
                  <option value="">Choose a till...</option>
                  {tills.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Opening Float (KES)</label>
                <Input 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  required 
                  value={openingFloat}
                  onChange={e => setOpeningFloat(e.target.value)}
                  placeholder="e.g. 5000"
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading || !selectedTill || !openingFloat}>
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Start Shift
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Active Shift</h1>
          <p className="text-muted-foreground">
            Till: {activeTill?.name} • Opened: {new Date(activeShift!.opened_at).toLocaleString()}
          </p>
        </div>
        <Button variant="outline" onClick={refreshReport} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Report
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* X-Report Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">X-Report Summary</CardTitle>
            <CardDescription>Current shift performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {report ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-secondary/50 p-4 rounded-xl border border-border">
                    <p className="text-sm text-muted-foreground mb-1">Total Sales</p>
                    <p className="text-2xl font-bold">{formatKES(report.total_sales)}</p>
                  </div>
                  <div className="bg-secondary/50 p-4 rounded-xl border border-border">
                    <p className="text-sm text-muted-foreground mb-1">Transactions</p>
                    <p className="text-2xl font-bold">{report.total_transactions}</p>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-border">
                  <h4 className="text-sm font-medium mb-3">Payment Breakdown</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cash (incl. float)</span>
                    <span className="font-medium">{formatKES(report.cash_sales + report.opening_float)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">M-Pesa</span>
                    <span className="font-medium">{formatKES(report.mpesa_sales)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Card</span>
                    <span className="font-medium">{formatKES(report.card_sales)}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-border">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discounts Given</span>
                    <span className="font-medium text-warning">{formatKES(report.total_discounts)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Voids</span>
                    <span className="font-medium text-destructive">{formatKES(report.total_voids)}</span>
                  </div>
                </div>

                <Button variant="secondary" className="w-full mt-4">
                  <Printer className="h-4 w-4 mr-2" />
                  Print X-Report
                </Button>
              </>
            ) : (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Close Shift Form */}
        <Card className="border-warning/50">
          <CardHeader>
            <CardTitle className="text-lg text-warning">Close Shift (Z-Report)</CardTitle>
            <CardDescription>Enter the physical cash counted in the drawer.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCloseShift} className="space-y-4">
              {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</div>}
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Counted Cash (KES)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">KES</span>
                  <Input 
                    type="number" 
                    min="0" 
                    step="0.01" 
                    required 
                    value={countedCash}
                    onChange={e => setCountedCash(e.target.value)}
                    className="pl-12 h-14 text-xl font-bold"
                    placeholder="Total cash in drawer"
                  />
                </div>
              </div>

              {report && countedCash && (
                <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Expected Cash</span>
                    <span className="font-medium">{formatKES(report.expected_cash)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Difference</span>
                    <span className={`font-bold ${
                      Number(countedCash) === report.expected_cash 
                        ? 'text-success' 
                        : 'text-destructive'
                    }`}>
                      {formatKES(Number(countedCash) - report.expected_cash)}
                    </span>
                  </div>
                </div>
              )}

              <Button 
                type="submit" 
                variant="warning" 
                className="w-full h-12" 
                disabled={isLoading || !countedCash}
              >
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Close Shift & Print Z-Report
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
