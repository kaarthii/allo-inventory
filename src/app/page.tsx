import { prisma } from '@/lib/prisma'
import { ProductCard } from '@/components/ProductCard'
import { ProductWithStock } from '@/types'

export const revalidate = 0 // Disable cache to always serve fresh stock levels

export default async function HomePage() {
  // Query database directly for ultra-fast, robust server rendering
  const dbProducts = await prisma.product.findMany({
    include: {
      stock: {
        include: {
          warehouse: true,
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  })

  // Format products matching our clean type structure
  const products: ProductWithStock[] = dbProducts.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    createdAt: p.createdAt.toISOString(),
    stocks: p.stock.map((s) => ({
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
      total: s.total,
      reserved: s.reserved,
      available: Math.max(0, s.total - s.reserved),
    })),
  }))

  return (
    <div className="min-h-screen bg-slate-50/50 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] dark:bg-zinc-950 dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)]">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-24 lg:px-8">
        
        {/* Modern Premium Header */}
        <header className="mx-auto max-w-3xl text-center mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/50 bg-emerald-50/50 px-3 py-1 text-xs font-semibold text-emerald-800 backdrop-blur-sm dark:border-emerald-800/30 dark:bg-emerald-950/20 dark:text-emerald-400">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Active Concurrency Protection
          </div>
          
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50 leading-none">
            Allo Health
          </h1>
          <p className="text-lg font-medium text-zinc-500 sm:text-xl dark:text-zinc-400">
            Real-time Inventory Reservation & Checkout Gateway. Secure your items with distributed locks and atomic guarantees.
          </p>
        </header>

        {/* Product Grid */}
        {products.length === 0 ? (
          <div className="text-center py-20 rounded-3xl border border-dashed border-zinc-200 bg-white/40 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/40">
            <h3 className="text-lg font-bold text-zinc-700 dark:text-zinc-300">No products found</h3>
            <p className="text-sm text-zinc-400 mt-1">Please ensure the database seed script has been successfully run.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* Footer Technical Callout */}
        <footer className="mt-24 border-t border-zinc-100 pt-8 dark:border-zinc-800/50">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 text-center sm:text-left">
            <div className="rounded-2xl border border-zinc-100 bg-white/40 p-5 backdrop-blur-xl dark:border-zinc-800/30 dark:bg-zinc-900/30">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">
                Distributed Lock
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Uses Upstash Redis <code>SET NX</code> with a 10s TTL to serialize checkout requests, fully resolving race conditions.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-white/40 p-5 backdrop-blur-xl dark:border-zinc-800/30 dark:bg-zinc-900/30">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">
                Atomic Transactions
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Database counters are incremented and decremented atomically in isolated Prisma transactions to protect data integrity.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-100 bg-white/40 p-5 backdrop-blur-xl dark:border-zinc-800/30 dark:bg-zinc-900/30">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">
                Idempotency Cache
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Requests carrying an <code>Idempotency-Key</code> are cached in Redis for 24 hours, shielding the core system from duplicate orders.
              </p>
            </div>
          </div>
        </footer>

      </div>
    </div>
  )
}
