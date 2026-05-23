# Concurrency-Safe Inventory Reservation System

This application is a concurrency-safe, high-performance inventory reservation system built for Allo Health. It is designed using **Next.js 14/16 App Router (React 19)**, **TypeScript (Strict Mode)**, **Prisma v7 ORM**, **Supabase PostgreSQL**, and **Upstash Redis**.

## Features & Requirements Met
1. **10-minute Holds**: Secures product quantities for exactly 10 minutes when a customer initiates checkout.
2. **Race-Condition-Free (Distributed Locking)**: Multiple simultaneous checkout requests for the same product in a warehouse are serialized. If only 1 unit is left and two users attempt to reserve it concurrently, exactly one succeeds (HTTP 201/200) and the other fails (HTTP 409).
3. **Atomic SQL Transactions**: Prisma transaction updates use atomic increments/decrements to avoid read-then-write anomalies.
4. **Idempotency Guard**: Checkouts carry an `Idempotency-Key` which is cached in Upstash Redis for 24 hours. Repeating a request with the same key returns the cached successful reservation immediately without re-decrementing stock.
5. **Lazy Cleanup & Cron Cleanup**: Expired holds are released automatically via Vercel Cron every minute. In development, holds are cleaned up lazily when checking out or manually canceling them.

---

## 🛠️ Tech Stack
* **Framework**: Next.js 16 (React 19, Tailwind CSS v4, shadcn/ui NOVA preset, Sonner)
* **Database & ORM**: Prisma v7 + Supabase Postgres
* **Distributed Locking & Caching**: Upstash Redis
* **Input Validation**: Zod (Strict schema validation)

---

## 🚀 Setup & Installation

### 1. Environment Variables
Create a `.env` file in the root of the project with the following values:

```env
# Supabase Postgres Connection Strings
DATABASE_URL="postgresql://postgres.your-pooler-url:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.your-direct-url:5432/postgres"

# Upstash Redis Connection Info
UPSTASH_REDIS_REST_URL="https://your-redis-url.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-redis-token"

# Vercel Cron Security Key
CRON_SECRET="allo-cron-secret-12345"
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Generate Database Client & Run Migrations
Prisma v7 uses `prisma.config.ts` for database configuration and driver adapters for runtime queries. Apply migrations using the direct (non-pooled) connection:
```bash
npx prisma migrate dev --name init
```
Generate the Prisma Client types:
```bash
npx prisma generate
```

### 4. Seed the Database
Run the seed script to populate warehouses, products, and available stock (10 initial units per SKU in each warehouse):
```bash
npx prisma db seed
```

### 5. Run the Local Server
Start the development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 🏗️ Technical Architecture

### 1. Concurrency Control (Distributed Lock)
To prevent race conditions during checkout:
* Before checking stock or reserving, the server attempts to acquire a Redis-based distributed lock on `reservation:{productId}:{warehouseId}` using `SET NX` with a 10-second TTL.
* **Lock Succeeded**: The server reads the current stock count, verifies `total - reserved >= quantity`, and runs a Prisma transaction to atomically increment the `reserved` count by the requested quantity and create the reservation.
* **Lock Failed**: If another concurrent thread holds the lock, the server immediately returns a `409 Conflict` with the message `"Could not acquire lock, try again"`. This prevents simultaneous threads from reading the same stock level and double-allocating units.
* The lock is released in a `finally` block to ensure it is always released, even if database errors occur.

### 2. Idempotency Implementation
* Each checkout reservation request includes an `Idempotency-Key` header.
* On request arrival, the server queries Redis for `idempotency:{key}`.
* If a cached entry is found, the server immediately returns the cached reservation response (HTTP 201) without processing anything.
* If not found, the reservation is processed and the success response is cached in Redis for 24 hours (`EX 86400`).

### 3. Hold Expiry & Cleanup
* **Vercel Cron Job**: Vercel Cron is configured in `vercel.json` to call `/api/cron/expire-reservations` every minute. It fetches all `PENDING` reservations where `expiresAt < now`, and in a transaction, marks them as `RELEASED` and decrements `Stock.reserved`.
* **Lazy Expiration (Fallback)**: When confirming a reservation on `/api/reservations/[id]/confirm`, if the reservation has expired, the server lazily releases the stock and returns a `410 Gone` to ensure a customer can never purchase an item whose hold has already expired.

---

## ⚖️ Architectural Trade-offs

1. **Locking Granularity**: 
   * *Choice*: The Redis lock is keyed per `productId` + `warehouseId` (e.g. `reservation:{productId}:{warehouseId}`).
   * *Trade-off*: Locking is extremely fine-grained. It serializes checkouts only for the *same product in the same warehouse*, which ensures very high global throughput. Traffic checking out different SKUs scales concurrently without bottlenecking.
2. **Lock Time-to-Live (TTL)**: 
   * *Choice*: The lock TTL is 10 seconds.
   * *Trade-off*: If a server node crashes mid-transaction before releasing the lock, the lock will self-expire in 10 seconds, keeping the SKU accessible. The tradeoff is that the transaction *must* complete within 10 seconds, which is well above standard DB transaction latency.
3. **Alternative: Postgres Advisory Locks**:
   * *Choice*: We used Upstash Redis as a distributed lock manager.
   * *Trade-off*: If we didn't have Redis available, we could implement distributed locking directly in Supabase using Postgres transaction advisory locks (`SELECT pg_advisory_xact_lock(key)`). This keeps the stack simpler (removing Redis as a dependency) but shifts the lock coordination overhead onto the relational database. Using Redis keeps lock scaling and storage separate from the database.
