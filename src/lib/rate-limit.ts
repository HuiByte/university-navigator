/**
 * 基于内存的轻量级速率限制器
 * 适用于单实例 Next.js 服务（未引入 Redis 的场景）
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

interface RateLimitResult {
  success: boolean
  remaining: number
}

// 利用 globalThis 单例，防止 Next.js dev 热重载导致 Map 和定时器重复创建
const globalForRateLimit = globalThis as typeof globalThis & {
  __rateLimitStore?: Map<string, RateLimitEntry>
  __rateLimitCleanupTimer?: NodeJS.Timeout
}

const store: Map<string, RateLimitEntry> =
  globalForRateLimit.__rateLimitStore ?? new Map()

if (!globalForRateLimit.__rateLimitStore) {
  globalForRateLimit.__rateLimitStore = store
}

/**
 * 启动定时清理任务，每 5 分钟清理 Map 中过期的 key
 * 防止长期运行导致内存溢出
 */
function startCleanupTimer(): void {
  if (globalForRateLimit.__rateLimitCleanupTimer) return

  const timer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (now >= entry.resetTime) {
        store.delete(key)
      }
    }
  }, 5 * 60 * 1000)

  // 防止定时器阻止 Node 进程退出
  timer.unref?.()
  globalForRateLimit.__rateLimitCleanupTimer = timer
}

startCleanupTimer()

/**
 * 检查速率限制
 * @param userId 用户标识
 * @param limit 窗口内最大请求次数
 * @param windowMs 窗口时长（毫秒）
 * @returns { success: 是否允许, remaining: 剩余次数 }
 */
export function checkRateLimit(
  userId: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const entry = store.get(userId)

  // 不存在记录或窗口已过期 → 重置计数
  if (!entry || now >= entry.resetTime) {
    store.set(userId, {
      count: 1,
      resetTime: now + windowMs,
    })
    return { success: true, remaining: limit - 1 }
  }

  // 已达上限 → 限流
  if (entry.count >= limit) {
    return { success: false, remaining: 0 }
  }

  // 放行，计数 +1
  entry.count++
  return { success: true, remaining: limit - entry.count }
}
