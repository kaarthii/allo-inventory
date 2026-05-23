import axios from 'axios'
import chalk from 'chalk'
import ora from 'ora'

// Ensure PROD_URL is provided
const prodUrl = process.env.PROD_URL
if (!prodUrl) {
  console.error(chalk.red.bold('Error: PROD_URL environment variable is required.'))
  console.error(chalk.yellow('Usage: PROD_URL=http://localhost:3000 npm run prod-check'))
  process.exit(1)
}

const api = axios.create({
  baseURL: prodUrl,
  timeout: 10000,
  validateStatus: () => true, // Don't throw on non-2xx so we can check exact status codes
})

interface ProductWithStock {
  id: string
  name: string
  stocks: {
    warehouseId: string
    warehouseName: string
    total: number
    reserved: number
    available: number
  }[]
}

interface Warehouse {
  id: string
  name: string
}

async function runSuite() {
  console.log(chalk.cyan.bold('\n🔍 Allo Health Production Check'))
  console.log(chalk.gray(`Base URL: ${prodUrl}\n`))

  let passed = 0
  let failed = 0
  let warnings = 0
  let criticalFailed = false

  // State shared between tests
  let targetProductId = ''
  let targetWarehouseId = ''
  let initialStockAvailable = 0
  let createdResId = ''
  let confirmResId = ''

  // Helper assertions
  function assertTest(name: string, condition: boolean, critical = true) {
    if (condition) {
      console.log(`✅ ${chalk.green(name)}`)
      passed++
    } else {
      console.log(`❌ ${chalk.red(name)}`)
      failed++
      if (critical) {
        criticalFailed = true
      }
    }
  }

  function printSection(name: string) {
    console.log(chalk.blue.bold(`\n[${name}]`))
  }

  // ==========================================
  // 1. API HEALTH CHECKS
  // ==========================================
  printSection('API Health')
  const spinnerProducts = ora('Checking GET /api/products...').start()
  try {
    const res = await api.get('/api/products')
    spinnerProducts.stop()
    
    if (res.status === 200 && Array.isArray(res.data) && res.data.length > 0) {
      assertTest(`GET /api/products — 200, ${res.data.length} products found`, true)
      
      // Select the first product and warehouse for downstream tests
      const product = res.data[0] as ProductWithStock
      targetProductId = product.id
      
      const stock = product.stocks.find(s => s.available > 0) || product.stocks[0]
      targetWarehouseId = stock.warehouseId
      initialStockAvailable = stock.available
    } else {
      assertTest('GET /api/products — 200, products found', false)
    }
  } catch (err: any) {
    spinnerProducts.stop()
    assertTest('GET /api/products — network error', false)
    console.error(chalk.red(err.message))
  }

  const spinnerWarehouses = ora('Checking GET /api/warehouses...').start()
  try {
    const res = await api.get('/api/warehouses')
    spinnerWarehouses.stop()
    if (res.status === 200 && Array.isArray(res.data) && res.data.length > 0) {
      assertTest(`GET /api/warehouses — 200, ${res.data.length} warehouses found`, true)
    } else {
      assertTest('GET /api/warehouses — 200, warehouses found', false)
    }
  } catch (err: any) {
    spinnerWarehouses.stop()
    assertTest('GET /api/warehouses — network error', false)
    console.error(chalk.red(err.message))
  }

  // Stop if basic health checks failed
  if (criticalFailed || !targetProductId || !targetWarehouseId) {
    console.log(chalk.red.bold('\n❌ CRITICAL HEALTH CHECKS FAILED. Terminating remaining tests.'))
    process.exit(1)
  }

  // ==========================================
  // 2. RESERVATION CREATION
  // ==========================================
  printSection('Reservation Creation')
  const spinnerRes1 = ora('Creating happy-path reservation...').start()
  try {
    const res = await api.post('/api/reservations', {
      productId: targetProductId,
      warehouseId: targetWarehouseId,
      quantity: 1,
    })
    spinnerRes1.stop()

    if (res.status === 201 && res.data && res.data.id) {
      createdResId = res.data.id
      assertTest(`POST /api/reservations — 201, reservation ${createdResId} created`, true)
      
      // Verify stock was decremented
      const prodRes = await api.get('/api/products')
      const updatedProd = prodRes.data.find((p: any) => p.id === targetProductId)
      const updatedStock = updatedProd.stocks.find((s: any) => s.warehouseId === targetWarehouseId)
      
      assertTest(
        `Stock decremented after reservation (${initialStockAvailable} → ${updatedStock.available})`,
        updatedStock.available === initialStockAvailable - 1
      )
    } else {
      assertTest('POST /api/reservations — happy path', false)
    }
  } catch (err: any) {
    spinnerRes1.stop()
    assertTest('POST /api/reservations — happy path network error', false)
  }

  const spinnerResLarge = ora('Creating reservation with excessive quantity...').start()
  try {
    const res = await api.post('/api/reservations', {
      productId: targetProductId,
      warehouseId: targetWarehouseId,
      quantity: 999999,
    })
    spinnerResLarge.stop()

    assertTest(
      `POST /api/reservations (qty 999999) — correctly returned 409`,
      res.status === 409
    )
  } catch (err: any) {
    spinnerResLarge.stop()
    assertTest('POST /api/reservations (qty 999999) — network error', false)
  }

  // ==========================================
  // 3. RESERVATION LIFECYCLE
  // ==========================================
  printSection('Reservation Lifecycle')
  if (createdResId) {
    const spinnerRelease = ora('Releasing reservation...').start()
    try {
      const res = await api.post(`/api/reservations/${createdResId}/release`)
      spinnerRelease.stop()

      if (res.status === 200 && res.data.status === 'RELEASED') {
        assertTest(`Release reservation — 200, status RELEASED`, true)

        // Verify stock was restored
        const prodRes = await api.get('/api/products')
        const updatedProd = prodRes.data.find((p: any) => p.id === targetProductId)
        const updatedStock = updatedProd.stocks.find((s: any) => s.warehouseId === targetWarehouseId)

        assertTest(
          `Stock restored after release (${initialStockAvailable - 1} → ${updatedStock.available})`,
          updatedStock.available === initialStockAvailable
        )
      } else {
        assertTest('Release reservation — success', false)
      }
    } catch (err: any) {
      spinnerRelease.stop()
      assertTest('Release reservation — network error', false)
    }
  }

  // Create another for confirm test
  let confirmResId2 = ''
  const spinnerConfirmPrep = ora('Creating reservation for confirmation test...').start()
  try {
    const res = await api.post('/api/reservations', {
      productId: targetProductId,
      warehouseId: targetWarehouseId,
      quantity: 1,
    })
    spinnerConfirmPrep.stop()
    if (res.status === 201) {
      confirmResId = res.data.id
    }
  } catch (err) {
    spinnerConfirmPrep.stop()
  }

  if (confirmResId) {
    const spinnerConfirm = ora('Confirming reservation...').start()
    try {
      const res = await api.post(`/api/reservations/${confirmResId}/confirm`)
      spinnerConfirm.stop()

      if (res.status === 200 && res.data.status === 'CONFIRMED') {
        assertTest(`Confirm reservation — 200, status CONFIRMED`, true)

        // Verify stock remains decremented
        const prodRes = await api.get('/api/products')
        const updatedProd = prodRes.data.find((p: any) => p.id === targetProductId)
        const updatedStock = updatedProd.stocks.find((s: any) => s.warehouseId === targetWarehouseId)

        assertTest(
          `Stock decremented after confirm (${initialStockAvailable} → ${updatedStock.available})`,
          updatedStock.available === initialStockAvailable - 1
        )
      } else {
        assertTest('Confirm reservation — success', false)
      }
    } catch (err: any) {
      spinnerConfirm.stop()
      assertTest('Confirm reservation — network error', false)
    }

    // Try to release already confirmed
    const spinnerReleaseConf = ora('Releasing already-confirmed reservation...').start()
    try {
      const res = await api.post(`/api/reservations/${confirmResId}/release`)
      spinnerReleaseConf.stop()
      assertTest(
        'Release already-confirmed — correctly returned 409',
        res.status === 409
      )
    } catch (err) {
      spinnerReleaseConf.stop()
      assertTest('Release already-confirmed — error', false)
    }
  }

  // Expiry manual warning
  console.log(`⚠️  ${chalk.yellow('410 expired test — MANUAL CHECK REQUIRED: test 410 by waiting for expiry')}`)
  warnings++

  // ==========================================
  // 4. CONCURRENCY TEST (CRITICAL)
  // ==========================================
  printSection('Concurrency Test ⚡')
  const spinnerConcurrency = ora('Executing simultaneous requests...').start()
  try {
    // 1. Check current available stock
    const prodRes = await api.get('/api/products')
    const product = prodRes.data.find((p: any) => p.id === targetProductId)
    const stock = product.stocks.find((s: any) => s.warehouseId === targetWarehouseId)
    const currentAvailable = stock.available

    if (currentAvailable <= 0) {
      spinnerConcurrency.stop()
      console.log(`⚠️  ${chalk.yellow('Skipping concurrency check: available stock is 0')}`)
      warnings++
    } else {
      // We will request the entire remaining available units in BOTH requests!
      // This guarantees that exactly one must succeed, and the other must fail with 409.
      const payload = {
        productId: targetProductId,
        warehouseId: targetWarehouseId,
        quantity: currentAvailable,
      }

      // Fire both simultaneously
      const [resA, resB] = await Promise.allSettled([
        api.post('/api/reservations', payload),
        api.post('/api/reservations', payload),
      ])

      spinnerConcurrency.stop()

      let statusA = 0
      let statusB = 0
      let successResId = ''

      if (resA.status === 'fulfilled') {
        statusA = resA.value.status
        if (statusA === 201) successResId = resA.value.data.id
      }
      if (resB.status === 'fulfilled') {
        statusB = resB.value.status
        if (statusB === 201) successResId = resB.value.data.id
      }

      console.log(`Request A → ${statusA === 201 ? chalk.green('201 ✅') : chalk.red(statusA)}`)
      console.log(`Request B → ${statusB === 201 ? chalk.green('201 ✅') : chalk.red(statusB)}`)

      // Assert exactly one 201 and one 409
      const isConcurrencySafe = 
        (statusA === 201 && statusB === 409) || 
        (statusA === 409 && statusB === 201)

      assertTest(
        'CONCURRENCY SAFE — exactly one succeeded, one rejected',
        isConcurrencySafe
      )

      // Clean up the successful reservation to restore stock
      if (successResId) {
        await api.post(`/api/reservations/${successResId}/release`)
      }
    }
  } catch (err: any) {
    spinnerConcurrency.stop()
    assertTest('Concurrency safety assertion failed with network error', false)
  }

  // ==========================================
  // 5. IDEMPOTENCY CHECK
  // ==========================================
  printSection('Idempotency')
  const spinnerIdem = ora('Testing Idempotency-Key header...').start()
  try {
    const key = `idem-test-${Date.now()}`
    const payload = {
      productId: targetProductId,
      warehouseId: targetWarehouseId,
      quantity: 1,
    }

    const res1 = await api.post('/api/reservations', payload, { headers: { 'Idempotency-Key': key } })
    const res2 = await api.post('/api/reservations', payload, { headers: { 'Idempotency-Key': key } })

    spinnerIdem.stop()

    if (res1.status === 201 && res2.status === 201) {
      const id1 = res1.data.id
      const id2 = res2.data.id
      
      assertTest(
        'Same Idempotency-Key returned same reservation id',
        id1 === id2
      )

      // Release it
      await api.post(`/api/reservations/${id1}/release`)
    } else {
      console.log(`⚠️  ${chalk.yellow('IDEMPOTENCY NOT IMPLEMENTED — OPTIONAL')}`)
      warnings++
    }
  } catch (err) {
    spinnerIdem.stop()
    console.log(`⚠️  ${chalk.yellow('IDEMPOTENCY NOT IMPLEMENTED — OPTIONAL')}`)
    warnings++
  }

  // ==========================================
  // 6. DATA INTEGRITY CHECKS
  // ==========================================
  printSection('Data Integrity')
  try {
    const res = await api.get('/api/products')
    let allPositive = true
    
    for (const p of res.data as ProductWithStock[]) {
      for (const s of p.stocks) {
        if (s.available < 0) {
          allPositive = false
        }
      }
    }

    assertTest('No negative stock values found', allPositive)
  } catch (err) {
    assertTest('Data integrity validation failed due to network error', false)
  }

  // ==========================================
  // FINAL RESULTS SUMMARY
  // ==========================================
  console.log(chalk.gray('\n================================'))
  console.log(`Results: ${chalk.green(`${passed} passed`)}, ${chalk.red(`${failed} failed`)}, ${chalk.yellow(`${warnings} warnings`)}`)
  
  if (failed > 0 || criticalFailed) {
    console.log(chalk.red.bold('\n❌ SOME CRITICAL CHECKS FAILED'))
    process.exit(1)
  } else {
    console.log(chalk.green.bold('\n✅ ALL CRITICAL CHECKS PASSED'))
    process.exit(0)
  }
}

runSuite()
