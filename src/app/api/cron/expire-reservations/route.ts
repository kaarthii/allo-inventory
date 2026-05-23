import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find all expired PENDING reservations
    const now = new Date()
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          lt: now,
        },
      },
    })

    let releasedCount = 0

    for (const res of expiredReservations) {
      try {
        await prisma.$transaction([
          prisma.stock.update({
            where: {
              productId_warehouseId: {
                productId: res.productId,
                warehouseId: res.warehouseId,
              },
            },
            data: {
              reserved: {
                decrement: res.quantity,
              },
            },
          }),
          prisma.reservation.update({
            where: { id: res.id },
            data: { status: 'RELEASED' },
          }),
        ])
        releasedCount++
      } catch (err) {
        console.error(`Failed to auto-expire reservation ${res.id} in cron:`, err)
      }
    }

    return NextResponse.json({ releasedCount })
  } catch (error) {
    console.error('Error in expire-reservations cron:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
