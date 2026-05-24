'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ProductWithStock } from '@/types'
import { Package, Warehouse, Circle, AlertCircle } from 'lucide-react'

// Helper to generate UUID for Idempotency
function generateUUID() {
  return 'idx_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

interface ProductCardProps {
  product: ProductWithStock
  index: number
}

// Map products to specific premium linear glow backdrops
const GRADIENT_MAP: Record<string, string> = {
  headphones: 'from-indigo-500/20 to-surface-card border-b border-indigo-500/10',
  keyboard: 'from-rose-500/20 to-surface-card border-b border-rose-500/10',
  'usb-hub': 'from-cyan-500/20 to-surface-card border-b border-cyan-500/10',
}

export function ProductCard({ product, index }: ProductCardProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [clientIdempotencyKey, setClientIdempotencyKey] = useState('')

  const gradient = GRADIENT_MAP[product.id] || 'from-text-tertiary/10 to-surface-card border-b border-border-subtle'

  // Stagger delays mapping
  const delays = [
    'animation-delay-0',
    'animation-delay-75',
    'animation-delay-150',
    'animation-delay-225',
    'animation-delay-300',
    'animation-delay-375'
  ]
  const delayClass = delays[index % delays.length]

  const totalAvailable = product.stocks.reduce((acc, s) => acc + s.available, 0)
  const isOutOfStock = totalAvailable === 0

  // Initialize form and generate idempotency key when opening the dialog
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open) {
      setClientIdempotencyKey(generateUUID())
      setQuantity(1)
      // Default to first warehouse with stock, or just first warehouse
      const availableWarehouse = product.stocks.find(s => s.available > 0)
      setSelectedWarehouse(availableWarehouse?.warehouseId || product.stocks[0]?.warehouseId || '')
    }
  }

  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedWarehouse) {
      toast.error('Please select a warehouse.')
      return
    }

    if (quantity < 1 || !Number.isInteger(quantity)) {
      toast.error('Please enter a valid positive integer quantity.')
      return
    }

    const selectedStock = product.stocks.find(s => s.warehouseId === selectedWarehouse)
    if (!selectedStock || selectedStock.available < quantity) {
      toast.error(`Not enough stock available. Requested ${quantity}, but only ${selectedStock?.available || 0} is available.`)
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': clientIdempotencyKey,
        },
        body: JSON.stringify({
          productId: product.id,
          warehouseId: selectedWarehouse,
          quantity,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Inventory reserved successfully!', {
          description: 'Redirecting you to the checkout screen...',
        })
        setIsOpen(false)
        router.push(`/reservations/${data.id}`)
      } else {
        // Handle server-returned 409 or other errors
        console.error('Server error response:', data)
        const errorMessage = data.error || 'Failed to reserve inventory. Please try again.'
        toast.error(errorMessage, {
          duration: 5000,
        })
      }
    } catch (err) {
      console.error('Network error during reservation:', err)
      toast.error('A network error occurred. Please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Minus and Plus controls logic
  const selectedStock = product.stocks.find(s => s.warehouseId === selectedWarehouse)
  const maxQty = selectedStock ? selectedStock.available : 1

  const handleDecrement = () => {
    setQuantity(prev => Math.max(1, prev - 1))
  }

  const handleIncrement = () => {
    setQuantity(prev => Math.min(maxQty, prev + 1))
  }

  return (
    <Card className={`group overflow-hidden rounded-2xl border border-border-subtle bg-surface-card shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-indigo/40 hover:shadow-[0_8px_24px_rgba(99,102,241,0.08)] animate-fade-in-up ${delayClass}`}>
      {/* Visual Header Gradient */}
      <div className={`relative h-48 w-full bg-gradient-to-br ${gradient} p-6 flex flex-col justify-end overflow-hidden`}>
        {/* Subtle decorative glow */}
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/5 blur-2xl transition-transform duration-500 group-hover:scale-125" />
        
        {/* Absolute branding / category badge */}
        <div className="absolute top-4 right-4 rounded-full bg-surface-bg/60 border border-border-subtle px-3 py-1 text-2xs font-mono font-bold tracking-wider text-text-secondary backdrop-blur-md uppercase select-none">
          {isOutOfStock ? 'Sold Out' : 'Active'}
        </div>
        
        {/* Product Ambient Icon / Decorator */}
        <div className="mb-2 text-4xl select-none filter drop-shadow flex items-center justify-between w-full">
          <span>
            {product.id === 'headphones' && '🎧'}
            {product.id === 'keyboard' && '⌨️'}
            {product.id === 'usb-hub' && '🔌'}
          </span>
          <Package className="h-5 w-5 text-text-tertiary group-hover:text-brand-indigo transition-colors" />
        </div>

        <CardTitle className="text-xl font-heading font-bold tracking-tight text-white drop-shadow-sm leading-none">
          {product.name}
        </CardTitle>
      </div>

      <CardHeader className="p-5 pb-0">
        <CardDescription className="text-sm font-medium text-text-secondary line-clamp-2 min-h-10">
          {product.description || 'No description available.'}
        </CardDescription>
        <span className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider select-all mt-1 block">
          ID: {product.id}
        </span>
      </CardHeader>

      <CardContent className="p-5 pb-2 mt-4">
        <h4 className="text-2xs font-heading font-extrabold uppercase tracking-wider text-text-tertiary mb-3 select-none">
          Available Stock by Warehouse
        </h4>
        <div className="space-y-2.5">
          {product.stocks.map((stock) => (
            <div
              key={stock.warehouseId}
              className="flex items-center justify-between rounded-xl border border-border-subtle bg-surface-bg/30 px-3.5 py-3 text-xs transition-colors hover:border-border-hover"
            >
              <div className="flex items-center gap-2">
                <Warehouse className="h-3.5 w-3.5 text-text-tertiary" />
                <span className="font-semibold text-text-secondary">
                  {stock.warehouseName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-text-tertiary text-[10px] font-mono">
                  ({stock.reserved} reserved)
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-2xs font-bold tracking-wide border ${
                    stock.available > 5
                      ? 'bg-state-success/15 text-state-success border-state-success/20'
                      : stock.available > 0
                      ? 'bg-state-warning/15 text-state-warning border-state-warning/20'
                      : 'bg-state-danger/15 text-state-danger border-state-danger/20'
                  }`}
                >
                  {stock.available > 0 ? `${stock.available} available` : 'Out of stock'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter className="p-5">
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button
              disabled={isOutOfStock}
              className="w-full py-5 rounded-lg font-heading font-semibold bg-brand-indigo text-white hover:bg-brand-indigo-hover disabled:bg-text-tertiary/10 disabled:text-text-tertiary disabled:cursor-not-allowed disabled:border-transparent transition-all cursor-pointer select-none"
            >
              {isOutOfStock ? 'Out of Stock' : 'Reserve'}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl border border-border-subtle bg-surface-popover p-6 shadow-2xl backdrop-blur-md">
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-xl font-heading font-bold tracking-tight text-white">
                Reserve {product.name}
              </DialogTitle>
              <DialogDescription className="text-sm text-text-secondary leading-relaxed">
                Secures your stock for exactly 10 minutes. If payment is completed, the reservation becomes permanent.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleReserve} className="mt-6 space-y-5">
              <div className="space-y-2">
                <label className="text-2xs font-heading font-extrabold uppercase tracking-wider text-text-tertiary">
                  Select Warehouse Location
                </label>
                
                {/* Modern Styled Radio Selector Grid instead of dropdown select */}
                <div className="grid grid-cols-1 gap-3">
                  {product.stocks.map((stock) => {
                    const isDisabled = stock.available === 0
                    const isSelected = selectedWarehouse === stock.warehouseId
                    return (
                      <button
                        key={stock.warehouseId}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          setSelectedWarehouse(stock.warehouseId)
                          setQuantity(1) // reset quantity to 1 when changing warehouse
                        }}
                        className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all cursor-pointer ${
                          isDisabled
                            ? 'opacity-30 cursor-not-allowed border-border-subtle bg-surface-card/20'
                            : isSelected
                            ? 'border-brand-indigo bg-brand-indigo/10 shadow-[0_0_12px_rgba(99,102,241,0.15)] text-white'
                            : 'border-border-subtle bg-surface-bg/40 hover:border-border-hover text-text-primary'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold">{stock.warehouseName}</span>
                          <span className="text-xs text-text-secondary mt-0.5">
                            {stock.available} available ({stock.reserved} reserved)
                          </span>
                        </div>
                        {/* Styled Radio Circle */}
                        <div className={`h-5 w-5 rounded-full border flex items-center justify-center transition-all ${
                          isSelected ? 'border-brand-indigo bg-brand-indigo' : 'border-border-subtle'
                        }`}>
                          {isSelected && <Circle className="h-2 w-2 text-white fill-white animate-scale-in" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Styled Quantity input with custom +/- controls */}
              <div className="space-y-2">
                <label className="text-2xs font-heading font-extrabold uppercase tracking-wider text-text-tertiary">
                  Quantity to Reserve
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDecrement}
                    disabled={quantity <= 1}
                    className="h-11 w-11 flex items-center justify-center rounded-xl bg-surface-bg/60 border border-border-subtle hover:border-border-hover disabled:opacity-30 disabled:cursor-not-allowed text-white text-lg font-bold cursor-pointer transition-all"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={maxQty}
                    value={quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1
                      setQuantity(Math.max(1, Math.min(maxQty, val)))
                    }}
                    className="flex-1 h-11 text-center font-heading font-bold rounded-xl border border-border-subtle bg-surface-bg text-white outline-none focus:border-brand-indigo [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleIncrement}
                    disabled={quantity >= maxQty}
                    className="h-11 w-11 flex items-center justify-center rounded-xl bg-surface-bg/60 border border-border-subtle hover:border-border-hover disabled:opacity-30 disabled:cursor-not-allowed text-white text-lg font-bold cursor-pointer transition-all"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Idempotency Key debug notice */}
              <div className="rounded-xl bg-surface-bg border border-border-subtle p-3.5 text-[10px] text-text-tertiary select-none">
                <span className="font-mono font-bold uppercase tracking-wider mr-1 text-brand-teal">Idempotency Key:</span>
                <code className="select-all font-mono text-text-secondary">{clientIdempotencyKey}</code>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-5 rounded-lg font-heading font-bold bg-brand-indigo hover:bg-brand-indigo-hover text-white disabled:opacity-60 disabled:cursor-not-allowed shadow-lg cursor-pointer"
                >
                  {isLoading ? 'Reserving Stock...' : 'Confirm Reservation'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  )
}
