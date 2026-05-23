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

    // 3. If expiresAt < now, lazy-release the reservation and return 410
    const now = new Date()
    if (new Date(reservation.expiresAt) < now) {
      const [updatedReservation] = await prisma.$transaction([
        prisma.reservation.update({
          where: { id },
          data: { status: 'RELEASED' },
          include: { product: true, warehouse: true },
        }),
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
      ])

      return NextResponse.json(
        { error: 'Reservation has expired', reservation: updatedReservation },
        { status: 410 }
      )
    }

    // 4. Use Prisma transaction to confirm reservation and permanently decrement stock
    const [_, updatedReservation] = await prisma.$transaction([
      prisma.stock.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: {
          total: {
            decrement: reservation.quantity,
          },
          reserved: {
            decrement: reservation.quantity,
          },
        },
      }),
      prisma.reservation.update({
        where: { id },
        data: { status: 'CONFIRMED' },
        include: { product: true, warehouse: true },
      }),
    ])

    return NextResponse.json(updatedReservation, { status: 200 })
  } catch (error) {
    console.error('Error confirming reservation:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
