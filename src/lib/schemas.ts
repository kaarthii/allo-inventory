import { z } from 'zod'

export const CreateReservationSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
})

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>
