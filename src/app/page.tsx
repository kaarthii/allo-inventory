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
    <div className="min-h-screen bg-surface-bg bg-[radial-gradient(#1e2433_1px,transparent_1px)] [background-size:32px_32px]">
      <div className="mx-auto max-w-7xl px-6 py-10 sm:py-16 lg:px-8">
        
        {/* Modern Premium Header Section */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-16 pb-8 border-b border-border-subtle">
          <div className="space-y-2">
            <h1 className="text-4xl font-heading font-bold tracking-tight text-white sm:text-5xl">
              Inventory
            </h1>
            <p className="text-base text-text-secondary max-w-xl">
              Real-time stock across all warehouses. Secured by high-concurrency safeguards.
            </p>
          </div>
          
          <div className="flex items-center self-start md:self-auto">
            <span className="inline-flex items-center gap-2 rounded-full border border-state-success/20 bg-state-success/10 px-3.5 py-1.5 text-xs font-semibold text-state-success shadow-[0_0_12px_rgba(16,185,129,0.15)] select-none">
              <span className="flex h-2 w-2 rounded-full bg-state-success animate-pulse-dot" />
              Live
            </span>
          </div>
        </header>

        {/* Product Grid */}
        {products.length === 0 ? (
          <div className="text-center py-24 rounded-3xl border border-dashed border-border-subtle bg-surface-card/50 backdrop-blur-xl">
            <h3 className="text-lg font-heading font-bold text-text-primary">No products found</h3>
            <p className="text-sm text-text-secondary mt-2">Please ensure the database seed script has been successfully run.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product, idx) => (
              <ProductCard key={product.id} product={product} index={idx} />
            ))}
          </div>
        )}

        {/* Footer Technical Callout */}
        <footer className="mt-28 border-t border-border-subtle pt-12">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 text-center sm:text-left">
            <div className="rounded-2xl border border-border-subtle bg-surface-card p-6 backdrop-blur-xl hover:border-border-hover hover:translate-y-[-1px] transition-all">
              <h3 className="text-xs font-heading font-extrabold uppercase tracking-wider text-brand-indigo mb-2">
                Distributed Lock
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Uses Upstash Redis <code className="text-brand-teal font-mono">SET NX</code> with a 10s TTL to serialize checkout requests, fully resolving race conditions.
              </p>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-surface-card p-6 backdrop-blur-xl hover:border-border-hover hover:translate-y-[-1px] transition-all">
              <h3 className="text-xs font-heading font-extrabold uppercase tracking-wider text-brand-indigo mb-2">
                Atomic Transactions
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Database counters are incremented and decremented atomically in isolated Prisma transactions to protect data integrity.
              </p>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-surface-card p-6 backdrop-blur-xl hover:border-border-hover hover:translate-y-[-1px] transition-all">
              <h3 className="text-xs font-heading font-extrabold uppercase tracking-wider text-brand-indigo mb-2">
                Idempotency Cache
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Requests carrying an <code className="text-brand-teal font-mono">Idempotency-Key</code> are cached in Redis for 24 hours, shielding the core system from duplicate orders.
              </p>
            </div>
          </div>
        </footer>

      </div>
    </div>
  )
}
