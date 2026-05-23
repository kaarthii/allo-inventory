'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Reservation, ReservationStatus } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function ReservationPage({ params }: PageProps) {
  const router = useRouter()
  // React 19 unwraps params via `use()`
  const resolvedParams = use(params)
  const reservationId = resolvedParams.id

  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [status, setStatus] = useState<ReservationStatus>('PENDING')
  const [timeLeft, setTimeLeft] = useState<string>('10:00')
  const [isExpired, setIsExpired] = useState(false)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)

  // Fetch reservation details
  useEffect(() => {
    async function fetchReservation() {
      try {
        const response = await fetch(`/api/reservations/${reservationId}`)
        if (!response.ok) {
          if (response.status === 404) {
            toast.error('Reservation not found.')
            router.push('/')
          } else {
            throw new Error('Failed to load reservation.')
          }
          return
        }

        const data = (await response.json()) as Reservation
        setReservation(data)
        setStatus(data.status)
        
        // Check if already expired on fetch
        const isPast = new Date(data.expiresAt).getTime() < Date.now()
        if (data.status === 'PENDING' && isPast) {
          setIsExpired(true)
          setStatus('RELEASED')
        }
      } catch (err) {
        console.error('Error fetching reservation:', err)
        toast.error('Failed to load reservation details.')
      } finally {
        setIsFetching(false)
      }
    }

    fetchReservation()
  }, [reservationId, router])

  // Live Timer Countdown
  useEffect(() => {
    if (!reservation || status !== 'PENDING') return

    const calculateTimeLeft = () => {
      const difference = new Date(reservation.expiresAt).getTime() - Date.now()
      
      if (difference <= 0) {
        setTimeLeft('00:00')
        setIsExpired(true)
        setStatus('RELEASED')
        toast.warning('Reservation has expired!', {
          description: 'The reserved stock has been returned to the available pool.',
        })
        return false
      }

      const minutes = Math.floor((difference / 1000 / 60) % 60)
      const seconds = Math.floor((difference / 1000) % 60)

      const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`
      const secStr = seconds < 10 ? `0${seconds}` : `${seconds}`

      setTimeLeft(`${minStr}:${secStr}`)
      return true
    }

    // Run first tick
    const active = calculateTimeLeft()
    if (!active) return

    const interval = setInterval(() => {
      const active = calculateTimeLeft()
      if (!active) {
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [reservation, status])

  const handleConfirm = async () => {
    if (!reservation) return
    setIsActionLoading(true)

    try {
      const response = await fetch(`/api/reservations/${reservationId}/confirm`, {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        setStatus('CONFIRMED')
        toast.success('Purchase completed!', {
          description: 'Your inventory has been permanently allocated.',
        })
      } else if (response.status === 410) {
        setStatus('RELEASED')
        setIsExpired(true)
        toast.error('Transaction Failed: Reservation Expired', {
          description: data.error || 'The reservation timer ran out.',
        })
      } else {
        toast.error(data.error || 'Failed to confirm purchase.')
      }
    } catch (err) {
      console.error('Error confirming reservation:', err)
      toast.error('A network error occurred. Please try again.')
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleRelease = async () => {
    if (!reservation) return
    setIsActionLoading(true)

    try {
      const response = await fetch(`/api/reservations/${reservationId}/release`, {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        setStatus('RELEASED')
        toast.success('Reservation cancelled', {
          description: 'Items have been returned to the available stock pool.',
        })
      } else {
        toast.error(data.error || 'Failed to release reservation.')
      }
    } catch (err) {
      console.error('Error releasing reservation:', err)
      toast.error('A network error occurred. Please try again.')
    } finally {
      setIsActionLoading(false)
    }
  }

  if (isFetching) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-950 dark:border-zinc-800 dark:border-t-zinc-50" />
          <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Securing your checkout terminal...</p>
        </div>
      </div>
    )
  }

  if (!reservation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <p className="text-zinc-500">Error loading reservation. Returning home...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/50 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] dark:bg-zinc-950 dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl">
        
        {/* Floating Return Button */}
        <Button
          variant="ghost"
          onClick={() => router.push('/')}
          className="mb-6 gap-2 rounded-xl text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50 cursor-pointer"
        >
          ← Return to Product Store
        </Button>

        {/* Premium Receipt-style Checkout Card */}
        <Card className="rounded-3xl border border-zinc-100 bg-white/70 shadow-2xl shadow-zinc-200/50 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/70 dark:shadow-none">
          <CardHeader className="p-8 pb-4 text-center border-b border-zinc-100 dark:border-zinc-800/50">
            <div className="mx-auto mb-4">
              {status === 'PENDING' && (
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 animate-bounce">
                  ⏳
                </div>
              )}
              {status === 'CONFIRMED' && (
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400">
                  ✓
                </div>
              )}
              {status === 'RELEASED' && (
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400">
                  ✕
                </div>
              )}
            </div>

            <CardTitle className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">
              Checkout Terminal
            </CardTitle>
            <CardDescription className="text-zinc-500 dark:text-zinc-400 font-mono text-xs select-all mt-1">
              RESERVATION ID: {reservation.id}
            </CardDescription>

            <div className="mt-4 flex justify-center">
              {status === 'PENDING' && (
                <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold px-3 py-1 border border-amber-200/40 rounded-full dark:bg-amber-950/30 dark:text-amber-400">
                  PENDING PURCHASE
                </Badge>
              )}
              {status === 'CONFIRMED' && (
                <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold px-3 py-1 border border-emerald-200/40 rounded-full dark:bg-emerald-950/30 dark:text-emerald-400">
                  TRANSACTION CONFIRMED
                </Badge>
              )}
              {status === 'RELEASED' && (
                <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold px-3 py-1 border border-rose-200/40 rounded-full dark:bg-rose-950/30 dark:text-rose-400">
                  {isExpired ? 'RESERVATION EXPIRED' : 'RESERVATION RELEASED'}
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-8 space-y-6">
            
            {/* Countdown Clock Display */}
            {status === 'PENDING' && (
              <div className="text-center bg-zinc-50/50 dark:bg-zinc-800/20 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800/50">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block mb-1">
                  Time Remaining to Complete Payment
                </span>
                <span className="text-5xl font-black font-mono tracking-wider text-amber-600 dark:text-amber-400 drop-shadow-sm select-none">
                  {timeLeft}
                </span>
              </div>
            )}

            {status === 'CONFIRMED' && (
              <div className="text-center bg-emerald-50/20 dark:bg-emerald-950/10 rounded-2xl p-6 border border-emerald-100/50 dark:border-emerald-900/20">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">
                  Allocation Status
                </span>
                <span className="text-lg font-bold text-emerald-800 dark:text-emerald-400">
                  Stock Allocated Permanently. Thank you for your purchase!
                </span>
              </div>
            )}

            {status === 'RELEASED' && (
              <div className="text-center bg-rose-50/20 dark:bg-rose-950/10 rounded-2xl p-6 border border-rose-100/50 dark:border-rose-900/20">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block mb-1">
                  Allocation Status
                </span>
                <span className="text-lg font-bold text-rose-800 dark:text-rose-400">
                  {isExpired 
                    ? '10-minute hold window expired. Stock has been auto-released.' 
                    : 'Reservation cancelled successfully. Stock returned.'}
                </span>
              </div>
            )}

            {/* Product Details Section */}
            <div className="space-y-4">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Order Summary
              </h4>
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50/30 p-5 space-y-3 dark:border-zinc-800/50 dark:bg-zinc-800/10 text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold text-zinc-500 dark:text-zinc-400">Product</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">{reservation.product?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-zinc-500 dark:text-zinc-400">Warehouse Location</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">{reservation.warehouse?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-zinc-500 dark:text-zinc-400">Quantity Reserved</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">{reservation.quantity} units</span>
                </div>
                {reservation.idempotencyKey && (
                  <div className="flex justify-between border-t border-dashed border-zinc-200 pt-2 dark:border-zinc-800">
                    <span className="font-semibold text-zinc-400 text-xs">Idempotency Key</span>
                    <span className="font-mono text-zinc-500 text-xs">{reservation.idempotencyKey}</span>
                  </div>
                )}
              </div>
            </div>

          </CardContent>

          {/* Action Buttons */}
          {status === 'PENDING' && (
            <CardFooter className="p-8 pt-0 flex flex-col gap-3">
              <Button
                onClick={handleConfirm}
                disabled={isActionLoading}
                className="w-full py-6 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600 shadow-lg cursor-pointer"
              >
                {isActionLoading ? 'Processing Payment...' : 'Confirm Purchase (Simulate Payment)'}
              </Button>
              <Button
                variant="outline"
                onClick={handleRelease}
                disabled={isActionLoading}
                className="w-full py-6 rounded-xl font-semibold border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Cancel Reservation
              </Button>
            </CardFooter>
          )}

          {status !== 'PENDING' && (
            <CardFooter className="p-8 pt-0">
              <Button
                onClick={() => router.push('/')}
                className="w-full py-6 rounded-xl font-bold bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 cursor-pointer"
              >
                Back to Product Store
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  )
}
