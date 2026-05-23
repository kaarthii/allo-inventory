export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'RELEASED'

export interface Warehouse {
  id: string
  name: string
  location: string
  createdAt: Date | string
}

export interface Stock {
  id: string
  productId: string
  warehouseId: string
  total: number
  reserved: number
  warehouse?: Warehouse
}

export interface Product {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  createdAt: Date | string
  stock?: Stock[]
}

export interface Reservation {
  id: string
  productId: string
  warehouseId: string
  quantity: number
  status: ReservationStatus
  expiresAt: Date | string
  createdAt: Date | string
  updatedAt: Date | string
  idempotencyKey: string | null
  product?: Product
  warehouse?: Warehouse
}

export interface ProductWithStock {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  createdAt: Date | string
  stocks: {
    warehouseId: string
    warehouseName: string
    total: number
    reserved: number
    available: number
  }[]
}
