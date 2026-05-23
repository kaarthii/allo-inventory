import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. Fetch reservation by ID
    const reservation = await prisma.reservation.findUnique({
      where: { id },
    })

    if (!reservation) {
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      )
    }

    // 2. If status is not PENDING, return 409
    if (reservation.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Reservation is not in PENDING state' },
        { status: 409 }
      )
    }

    // 3. Use Prisma transaction to release reservation and return units to available pool
    const [_, updatedReservation] = await prisma.$transaction([
      prisma.stock.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: {
          reserved: {
            decrement: reservation.quantity,
          },
        },
      }),
      prisma.reservation.update({
        where: { id },
        data: { status: 'RELEASED' },
        include: { product: true, warehouse: true },
      }),
    ])

    return NextResponse.json(updatedReservation, { status: 200 })
  } catch (error) {
    console.error('Error releasing reservation:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
