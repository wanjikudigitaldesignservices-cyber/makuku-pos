import { useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Delete, Check, X } from 'lucide-react'

interface PinPadProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  onSubmit: (pin: string) => Promise<boolean>
  maxLength?: number
}

export function PinPad({
  open,
  onOpenChange,
  title = 'Enter PIN',
  description = 'Enter your staff PIN to continue',
  onSubmit,
  maxLength = 6,
}: PinPadProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [locked, setLocked] = useState(false)

  const handleDigit = useCallback((digit: string) => {
    if (locked || pin.length >= maxLength) return
    setPin((prev) => prev + digit)
    setError('')
  }, [locked, pin.length, maxLength])

  const handleBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1))
    setError('')
  }, [])

  const handleClear = useCallback(() => {
    setPin('')
    setError('')
  }, [])

  const handleSubmit = useCallback(async () => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits')
      return
    }

    setIsLoading(true)
    try {
      const success = await onSubmit(pin)
      if (success) {
        setPin('')
        setAttempts(0)
        onOpenChange(false)
      } else {
        const newAttempts = attempts + 1
        setAttempts(newAttempts)
        setError(`Invalid PIN (${5 - newAttempts} attempts remaining)`)
        setPin('')

        if (newAttempts >= 5) {
          setLocked(true)
          setError('Too many attempts. Locked for 60 seconds.')
          setTimeout(() => {
            setLocked(false)
            setAttempts(0)
            setError('')
          }, 60000)
        }
      }
    } catch {
      setError('Verification failed')
      setPin('')
    } finally {
      setIsLoading(false)
    }
  }, [pin, attempts, onSubmit, onOpenChange])

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back']

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* PIN display */}
        <div className="flex justify-center gap-2 my-4">
          {Array.from({ length: maxLength }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                i < pin.length
                  ? 'bg-primary scale-110 shadow-lg shadow-primary/30'
                  : 'bg-secondary'
              }`}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <p className="text-center text-sm text-destructive animate-fade-in">
            {error}
          </p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {keys.map((key) => {
            if (key === 'clear') {
              return (
                <button
                  key={key}
                  onClick={handleClear}
                  disabled={locked || isLoading}
                  className="pin-key text-base text-muted-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              )
            }
            if (key === 'back') {
              return (
                <button
                  key={key}
                  onClick={handleBackspace}
                  disabled={locked || isLoading}
                  className="pin-key text-base text-muted-foreground"
                >
                  <Delete className="h-5 w-5" />
                </button>
              )
            }
            return (
              <button
                key={key}
                onClick={() => handleDigit(key)}
                disabled={locked || isLoading}
                className="pin-key"
              >
                {key}
              </button>
            )
          })}
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={pin.length < 4 || locked || isLoading}
          className="w-full mt-4"
          size="lg"
        >
          <Check className="h-4 w-4" />
          {isLoading ? 'Verifying...' : 'Confirm'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
