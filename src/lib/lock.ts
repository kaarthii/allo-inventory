import { redis } from './redis'

const LOCK_TTL = 10 // seconds

export async function acquireLock(key: string): Promise<boolean> {
  const result = await redis.set(`lock:${key}`, '1', {
    nx: true,
    ex: LOCK_TTL,
  })
  return result === 'OK'
}

export async function releaseLock(key: string): Promise<void> {
  await redis.del(`lock:${key}`)
}
