import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import 'dotenv/config'

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding warehouses...')
  const mumbai = await prisma.warehouse.upsert({
    where: { id: 'mumbai-hub' },
    update: {},
    create: {
      id: 'mumbai-hub',
      name: 'Mumbai Hub',
      location: 'Mumbai, MH',
    },
  })

  const delhi = await prisma.warehouse.upsert({
    where: { id: 'delhi-hub' },
    update: {},
    create: {
      id: 'delhi-hub',
      name: 'Delhi Hub',
      location: 'Delhi, NCR',
    },
  })

  console.log('Seeding products...')
  const headphones = await prisma.product.upsert({
    where: { id: 'headphones' },
    update: {},
    create: {
      id: 'headphones',
      name: 'Wireless Headphones',
      description: 'Premium active noise-cancelling wireless headphones with rich studio sound.',
      imageUrl: '/headphones.jpg',
    },
  })

  const keyboard = await prisma.product.upsert({
    where: { id: 'keyboard' },
    update: {},
    create: {
      id: 'keyboard',
      name: 'Mechanical Keyboard',
      description: 'Tactile mechanical gaming keyboard with customizable RGB backlighting and hot-swappable switches.',
      imageUrl: '/keyboard.jpg',
    },
  })

  const usbHub = await prisma.product.upsert({
    where: { id: 'usb-hub' },
    update: {},
    create: {
      id: 'usb-hub',
      name: 'USB-C Hub',
      description: '8-in-1 multi-port adapter featuring 4K HDMI, USB-A high-speed ports, SD readers, and 100W PD pass-through.',
      imageUrl: '/usb-hub.jpg',
    },
  })

  const products = [headphones, keyboard, usbHub]
  const warehouses = [mumbai, delhi]

  console.log('Seeding stock records...')
  for (const product of products) {
    for (const warehouse of warehouses) {
      await prisma.stock.upsert({
        where: {
          productId_warehouseId: {
            productId: product.id,
            warehouseId: warehouse.id,
          },
        },
        update: {
          total: 10,
        },
        create: {
          productId: product.id,
          warehouseId: warehouse.id,
          total: 10,
          reserved: 0,
        },
      })
    }
  }

  console.log('Database seeded successfully.')
}

main()
  .catch((e) => {
    console.error('Error during database seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
