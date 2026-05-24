'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Reservation, ReservationStatus } from '@/types'
import { Check, X, ArrowLeft, Clock, AlertCircle } from 'lucide-react'

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
  const [progressPct, setProgressPct] = useState<number>(100)
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

  // Live Timer Countdown & Progress percentage logic
  useEffect(() => {
    if (!reservation || status !== 'PENDING') return

    const calculateTimeLeft = () => {
      const expires = new Date(reservation.expiresAt).getTime()
      const created = new Date(reservation.createdAt).getTime()
      const total = expires - created
      const difference = expires - Date.now()
      
      if (difference <= 0) {
        setTimeLeft('00:00')
        setProgressPct(0)
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
      setProgressPct(Math.max(0, Math.min(100, (difference / total) * 100)))
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
      <div className="flex min-h-screen items-center justify-center bg-surface-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-border-subtle border-t-brand-indigo" />
          <p className="text-xs font-mono tracking-wider text-text-secondary select-none">Securing your checkout terminal...</p>
        </div>
      </div>
    )
  }

  if (!reservation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-bg select-none">
        <div className="text-center rounded-2xl border border-border-subtle bg-surface-card p-6">
          <AlertCircle className="h-8 w-8 text-state-danger mx-auto mb-2" />
          <p className="text-text-secondary text-sm">Error loading reservation. Returning home...</p>
        </div>
      </div>
    )
  }

  // Calculate dynamic colors for countdown progress bar
  const expiresTime = new Date(reservation.expiresAt).getTime()
  const differenceTime = expiresTime - Date.now()
  const diffMinutes = differenceTime / 1000 / 60
  
  let barColor = 'bg-brand-indigo shadow-[0_0_8px_rgba(99,102,241,0.4)]'
  if (diffMinutes < 1) {
    barColor = 'bg-state-danger shadow-[0_0_8px_rgba(244,63,94,0.4)]'
  } else if (diffMinutes <= 5) {
    barColor = 'bg-state-warning shadow-[0_0_8px_rgba(245,158,11,0.4)]'
  }

  const isUrgent = differenceTime < 60000 && status === 'PENDING'

  return (
    <div className="min-h-screen bg-surface-bg bg-[radial-gradient(#1e2433_1px,transparent_1px)] [background-size:32px_32px] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[560px]">
        
        {/* Back link */}
        <button
          onClick={() => router.push('/')}
          className="group mb-6 inline-flex items-center gap-2 rounded-lg text-xs font-mono tracking-wider uppercase text-text-secondary hover:text-white cursor-pointer transition-all select-none"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Back to products
        </button>

        {/* Receipt-style Checkout Card */}
        <Card className={`overflow-hidden rounded-2xl border border-border-subtle bg-surface-card shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-300 ${
          status === 'CONFIRMED' ? 'opacity-90' : status === 'RELEASED' ? 'opacity-80' : ''
        }`}>
          
          <CardHeader className="p-8 pb-6 border-b border-border-subtle">
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-1">
                <CardTitle className="text-2xl font-heading font-bold text-white tracking-tight leading-none">
                  {reservation.product?.name}
                </CardTitle>
                <CardDescription className="text-2xs font-mono text-text-secondary uppercase select-all tracking-wider block">
                  RESERVATION: {reservation.id}
                </CardDescription>
              </div>

              {/* Status Badge */}
              <div className="select-none">
                {status === 'PENDING' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-state-warning/20 bg-state-warning/15 px-3 py-1 text-2xs font-mono font-bold uppercase tracking-wide text-state-warning">
                    <span className="h-1.5 w-1.5 rounded-full bg-state-warning animate-pulse-dot" />
                    PENDING
                  </span>
                )}
                {status === 'CONFIRMED' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-state-success/20 bg-state-success/15 px-3 py-1 text-2xs font-mono font-bold uppercase tracking-wide text-state-success">
                    CONFIRMED
                  </span>
                )}
                {status === 'RELEASED' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-text-tertiary/10 px-3 py-1 text-2xs font-mono font-bold uppercase tracking-wide text-text-secondary">
                    {isExpired ? 'EXPIRED' : 'RELEASED'}
                  </span>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-8 space-y-6">
            
            {/* Countdown Clock Display (PENDING State) */}
            {status === 'PENDING' && !isExpired && (
              <div className="text-center bg-surface-bg/50 rounded-xl p-6 border border-border-subtle">
                <span className="text-2xs font-heading font-extrabold uppercase tracking-wider text-text-secondary block mb-1">
                  Time Remaining
                </span>
                
                {/* Large Syne font clock display ( MM:SS ) */}
                <span className={`text-[4rem] font-heading font-extrabold tracking-wider leading-none drop-shadow-md select-none block ${
                  isUrgent ? 'text-state-danger animate-timer-pulse' : 'text-white'
                }`}>
                  {timeLeft}
                </span>

                {/* Progress Bar */}
                <div className="w-full bg-surface-bg rounded-full h-1.5 overflow-hidden mt-4 border border-border-subtle">
                  <div
                    className={`h-full transition-all duration-1000 ease-linear rounded-full ${barColor}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Confirmed State Header */}
            {status === 'CONFIRMED' && (
              <div className="text-center py-6 select-none bg-state-success/5 border border-state-success/15 rounded-xl p-5">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-state-success/15 border border-state-success/25 text-state-success mb-3 animate-scale-in">
                  <Check className="h-6 w-6 stroke-[3]" />
                </div>
                <h2 className="text-xl font-heading font-bold text-white">
                  Reservation Confirmed
                </h2>
                <p className="text-xs text-text-secondary mt-1">
                  Units have been allocated to your order
                </p>
              </div>
            )}

            {/* Cancelled / Released State Header */}
            {status === 'RELEASED' && !isExpired && (
              <div className="text-center py-6 select-none bg-surface-bg/30 border border-border-subtle rounded-xl p-5">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-text-tertiary/10 border border-border-subtle text-text-secondary mb-3">
                  <X className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-heading font-bold text-text-primary">
                  Reservation Cancelled
                </h2>
                <p className="text-xs text-text-secondary mt-1">
                  Units have been returned to stock
                </p>
              </div>
            )}

            {/* Expired State Header (Alert box replaces timer) */}
            {status === 'RELEASED' && isExpired && (
              <div className="rounded-xl border border-state-danger/25 bg-state-danger/10 p-5 flex items-start gap-3 text-state-danger select-none">
                <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <h4 className="font-heading font-bold text-sm text-white">This reservation has expired</h4>
                  <p className="text-xs text-state-danger/80 leading-relaxed">
                    The 10-minute hold window for these items has expired. The stock has been auto-released and returned to available inventory.
                  </p>
                </div>
              </div>
            )}

            {/* Details Section */}
            <div className="space-y-4">
              <h4 className="text-2xs font-heading font-extrabold uppercase tracking-wider text-text-tertiary select-none">
                Order Summary
              </h4>
              <div className="rounded-xl border border-border-subtle bg-surface-bg/30 p-5 space-y-4 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-text-secondary">Quantity Reserved</span>
                  <span className="font-heading font-bold text-white text-sm">{reservation.quantity} {reservation.quantity === 1 ? 'unit' : 'units'}</span>
                </div>
                <div className="flex justify-between items-center border-t border-border-subtle/40 pt-3">
                  <span className="font-medium text-text-secondary">Warehouse Location</span>
                  <span className="font-heading font-bold text-white text-sm">{reservation.warehouse?.name}</span>
                </div>
                <div className="flex justify-between items-center border-t border-border-subtle/40 pt-3">
                  <span className="font-medium text-text-secondary">Reserved At</span>
                  <span className="font-mono text-text-secondary text-[11px]">{new Date(reservation.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center border-t border-border-subtle/40 pt-3">
                  <span className="font-medium text-text-secondary">Expires At</span>
                  <span className="font-mono text-text-secondary text-[11px]">{new Date(reservation.expiresAt).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {reservation.idempotencyKey && (
              <div className="rounded-xl bg-surface-bg border border-border-subtle p-3.5 text-[10px] text-text-tertiary select-none">
                <span className="font-mono font-bold uppercase tracking-wider mr-1 text-brand-teal">Idempotency Key:</span>
                <code className="select-all font-mono text-text-secondary">{reservation.idempotencyKey}</code>
              </div>
            )}

          </CardContent>

          {/* Action Buttons */}
          {status === 'PENDING' && !isExpired && (
            <CardFooter className="p-8 pt-0 flex flex-col gap-3">
              <Button
                onClick={handleConfirm}
                disabled={isActionLoading}
                className="w-full py-5 rounded-lg font-heading font-bold bg-brand-indigo hover:bg-brand-indigo-hover text-white flex items-center justify-center gap-2 shadow-lg disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer transition-all"
              >
                {isActionLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 stroke-[3]" />
                    Confirm Purchase (Simulate Payment)
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleRelease}
                disabled={isActionLoading}
                className="w-full py-5 rounded-lg font-heading font-semibold bg-transparent text-state-danger border border-state-danger/40 hover:bg-state-danger/10 flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer transition-all"
              >
                {isActionLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-state-danger border-t-transparent" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4" />
                    Cancel Reservation
                  </>
                )}
              </Button>
            </CardFooter>
          )}

          {/* Expired state action button */}
          {status === 'RELEASED' && isExpired && (
            <CardFooter className="p-8 pt-0">
              <Button
                onClick={() => router.push('/')}
                className="w-full py-5 rounded-lg font-heading font-bold bg-brand-indigo hover:bg-brand-indigo-hover text-white shadow-lg cursor-pointer transition-all"
              >
                Browse Products
              </Button>
            </CardFooter>
          )}

          {/* Confirmed / Cancelled State Actions */}
          {(status === 'CONFIRMED' || (status === 'RELEASED' && !isExpired)) && (
            <CardFooter className="p-8 pt-0">
              <Button
                onClick={() => router.push('/')}
                className="w-full py-5 rounded-lg font-heading font-bold bg-surface-bg border border-border-subtle text-white hover:border-border-hover cursor-pointer transition-all"
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
