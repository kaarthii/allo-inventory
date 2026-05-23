import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { redis } from '@/lib/redis'
import { acquireLock, releaseLock } from '@/lib/lock'
import { CreateReservationSchema } from '@/lib/schemas'

export async function POST(request: NextRequest) {
  let idempotencyKey: string | null = null
  let lockKey: string | null = null
  let isLockAcquired = false

  try {
    // 1. Check for Idempotency-Key header
    idempotencyKey = request.headers.get('idempotency-key')
    if (idempotencyKey) {
      const cachedResponse = await redis.get(`idempotency:${idempotencyKey}`)
      if (cachedResponse) {
        console.log(`Idempotency hit for key: ${idempotencyKey}`)
        const parsed = typeof cachedResponse === 'string' 
          ? JSON.parse(cachedResponse) 
          : (cachedResponse as { status: number; body: unknown })
        return NextResponse.json(parsed.body, { status: parsed.status })
      }
    }

    // 2. Parse and validate request body
    const body = await request.json()
    const result = CreateReservationSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: result.error.format() },
        { status: 400 }
      )
    }

    const { productId, warehouseId, quantity } = result.data

    // 3. Acquire distributed lock in Redis
    lockKey = `reservation:${productId}:${warehouseId}`
    isLockAcquired = await acquireLock(lockKey)
    if (!isLockAcquired) {
      return NextResponse.json(
        { error: 'Could not acquire lock, try again' },
        { status: 409 }
      )
    }

    // 4. Perform stock check and atomic reservation
    // Fetch the Stock record
    const stock = await prisma.stock.findUnique({
      where: {
        productId_warehouseId: {
          productId,
          warehouseId,
        },
      },
    })

    if (!stock) {
      return NextResponse.json(
        { error: 'Product is not stocked in this warehouse' },
        { status: 409 }
      )
    }

    const available = stock.total - stock.reserved
    if (available < quantity) {
      return NextResponse.json(
        { error: 'Insufficient stock' },
        { status: 409 }
      )
    }

    // Prisma Transaction: Atomically increment reserved stock & create Reservation
    const [_, newReservation] = await prisma.$transaction([
      prisma.stock.update({
        where: {
          productId_warehouseId: {
            productId,
            warehouseId,
          },
        },
        data: {
          reserved: {
            increment: quantity,
          },
        },
      }),
      prisma.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
          idempotencyKey: idempotencyKey || null,
        },
        include: {
          product: true,
          warehouse: true,
        },
      }),
    ])

    const jsonResponse = newReservation

    // 5. Cache response in Redis if idempotency key present
    if (idempotencyKey) {
      const cacheValue = JSON.stringify({
        status: 201,
        body: jsonResponse,
      })
      await redis.set(`idempotency:${idempotencyKey}`, cacheValue, { ex: 86400 }) // 24 hours
    }

    return NextResponse.json(jsonResponse, { status: 201 })
  } catch (error) {
    console.error('Error creating reservation:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  } finally {
    // 6. Always release lock
    if (lockKey && isLockAcquired) {
      await releaseLock(lockKey)
    }
  }
}
