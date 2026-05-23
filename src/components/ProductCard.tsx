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

// Helper to generate UUID for Idempotency
function generateUUID() {
  return 'idx_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

interface ProductCardProps {
  product: ProductWithStock
}

// Map products to specific luxury gradients
const GRADIENT_MAP: Record<string, string> = {
  headphones: 'from-violet-600 to-indigo-900 shadow-indigo-500/20',
  keyboard: 'from-pink-600 to-rose-950 shadow-rose-500/20',
  'usb-hub': 'from-cyan-600 to-teal-900 shadow-teal-500/20',
}

export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [clientIdempotencyKey, setClientIdempotencyKey] = useState('')

  const gradient = GRADIENT_MAP[product.id] || 'from-zinc-700 to-zinc-900 shadow-zinc-500/20'

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

  return (
    <Card className="group overflow-hidden rounded-2xl border border-zinc-100 bg-white/70 shadow-lg shadow-zinc-100 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-900/70 dark:shadow-none dark:hover:bg-zinc-900">
      {/* Visual Header Gradient */}
      <div className={`relative h-48 w-full bg-gradient-to-br ${gradient} p-6 flex flex-col justify-end overflow-hidden`}>
        {/* Subtle decorative glow */}
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 blur-2xl transition-transform duration-500 group-hover:scale-125" />
        
        {/* Absolute branding / category badge */}
        <div className="absolute top-4 right-4 rounded-full bg-black/25 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
          In Stock
        </div>
        
        {/* Product Ambient Icon / Decorator */}
        <div className="mb-2 text-4xl select-none filter drop-shadow">
          {product.id === 'headphones' && '🎧'}
          {product.id === 'keyboard' && '⌨️'}
          {product.id === 'usb-hub' && '🔌'}
        </div>

        <CardTitle className="text-xl font-bold tracking-tight text-white drop-shadow-sm leading-none">
          {product.name}
        </CardTitle>
      </div>

      <CardHeader className="p-5 pb-0">
        <CardDescription className="text-sm font-medium text-zinc-500 line-clamp-2 min-h-10 dark:text-zinc-400">
          {product.description || 'No description available.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-5 pb-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3">
          Available Stock by Warehouse
        </h4>
        <div className="space-y-2.5">
          {product.stocks.map((stock) => (
            <div
              key={stock.warehouseId}
              className="flex items-center justify-between rounded-lg border border-zinc-50 bg-zinc-50/50 px-3 py-2 text-xs transition-colors dark:border-zinc-800 dark:bg-zinc-800/30"
            >
              <span className="font-semibold text-zinc-600 dark:text-zinc-300">
                {stock.warehouseName}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-zinc-400 text-[10px]">
                  ({stock.reserved} reserved)
                </span>
                <Badge
                  variant={stock.available > 0 ? 'secondary' : 'destructive'}
                  className={`px-2.5 py-0.5 font-bold tracking-wide rounded-md ${
                    stock.available > 0
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400'
                  }`}
                >
                  {stock.available > 0 ? `${stock.available} available` : 'Out of stock'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter className="p-5">
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button
              className="w-full py-6 rounded-xl font-bold bg-zinc-950 text-white shadow-xl hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 transition-all cursor-pointer"
            >
              Reserve Inventory
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl border border-zinc-100 bg-white/95 p-6 shadow-2xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight">
                Reserve {product.name}
              </DialogTitle>
              <DialogDescription className="text-zinc-500 dark:text-zinc-400">
                Secures your stock for exactly 10 minutes. If payment is completed, the reservation becomes permanent.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleReserve} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Select Warehouse Location
                </label>
                <select
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-sm font-semibold outline-none focus:border-zinc-950 dark:border-zinc-800 dark:bg-zinc-900/50 dark:focus:border-zinc-50"
                  required
                >
                  {product.stocks.map((stock) => (
                    <option key={stock.warehouseId} value={stock.warehouseId} disabled={stock.available === 0}>
                      {stock.warehouseName} ({stock.available} left)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Quantity to Reserve
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-sm font-semibold outline-none focus:border-zinc-950 dark:border-zinc-800 dark:bg-zinc-900/50 dark:focus:border-zinc-50"
                  required
                />
              </div>

              {/* Idempotency Key debug notice */}
              <div className="rounded-lg bg-zinc-50 p-3 text-[10px] text-zinc-400 dark:bg-zinc-900/50 dark:text-zinc-500">
                <span className="font-bold uppercase tracking-wide mr-1">Idempotency Key:</span>
                <code className="select-all font-mono">{clientIdempotencyKey}</code>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-6 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600 shadow-lg cursor-pointer"
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
