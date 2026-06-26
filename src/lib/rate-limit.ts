/**
 * 速率限制器 - 支持分布式与内存双模式
 *
 * 生产模式：当 UPSTASH_REDIS_REST_URL 和 UPSTASH_REDIS_REST_TOKEN 存在时，
 *           使用 @upstash/ratelimit + @upstash/redis 进行分布式限流
 * 本地降级模式：环境变量不存在时，回退到 globalThis Map 内存限流
 */

import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import { env } from "./env"

interface RateLimitEntry {
  count: number
  resetTime: number
}

interface RateLimitResult {
  success: boolean
  remaining: number
}

// ---- 全局单例 ----
const globalForRateLimit = globalThis as typeof globalThis & {
  __upstashRedis?: Redis
  __upstashRatelimiters?: Map<string, Ratelimit>
  __rateLimitStore?: Map<string, RateLimitEntry>
  __rateLimitCleanupTimer?: NodeJS.Timeout
}

const UPSTASH_URL = env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = env.UPSTASH_REDIS_REST_TOKEN
const useUpstash = !!(UPSTASH_URL && UPSTASH_TOKEN)

/**
 * 获取或创建指定 (limit, window) 对应的 Ratelimit 实例
 * 使用 globalThis 缓存，防止 Serverless 环境下重复创建
 */
function getRatelimit(limit: number, windowSeconds: number): Ratelimit {
  const cacheKey = `${limit}:${windowSeconds}`

  if (!globalForRateLimit.__upstashRatelimiters) {
    globalForRateLimit.__upstashRatelimiters = new Map()
  }

  const cached = globalForRateLimit.__upstashRatelimiters.get(cacheKey)
  if (cached) return cached

  // Redis 客户端也使用单例
  if (!globalForRateLimit.__upstashRedis) {
    globalForRateLimit.__upstashRedis = new Redis({
      url: UPSTASH_URL!,
      token: UPSTASH_TOKEN!,
    })
  }

  const instance = new Ratelimit({
    redis: globalForRateLimit.__upstashRedis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
  })

  globalForRateLimit.__upstashRatelimiters.set(cacheKey, instance)
  return instance
}

if (!useUpstash && typeof window === "undefined" && process.env.NODE_ENV !== "production") {
  console.warn(
    "未配置 Upstash Redis 环境变量，已降级为内存速率限制，不支持多实例部署"
  )
}

// 生产环境硬阻断：lazy 检查（首次调用 checkRateLimit 时触发）
// 不在模块加载时抛错，避免 next build 阶段加载 API 路由模块时误触发导致构建失败
// 在 Serverless 冷启动首次请求时触发，等效于"阻断启动"
let productionConfigChecked = false
function assertProductionConfig(): void {
  if (productionConfigChecked) return
  productionConfigChecked = true
  if (process.env.NODE_ENV === "production" && !useUpstash) {
    throw new Error(
      "生产环境必须配置 UPSTASH_REDIS_REST_URL 和 UPSTASH_REDIS_REST_TOKEN，" +
        "内存限流不支持多实例部署。请检查环境变量配置。"
    )
  }
}

// ---- 内存降级模式 ----
const store: Map<string, RateLimitEntry> =
  globalForRateLimit.__rateLimitStore ?? new Map()

if (!globalForRateLimit.__rateLimitStore) {
  globalForRateLimit.__rateLimitStore = store
}

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

  timer.unref?.()
  globalForRateLimit.__rateLimitCleanupTimer = timer
}

startCleanupTimer()

/**
 * 内存模式限流实现
 */
function checkRateLimitMemory(
  userId: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const entry = store.get(userId)

  if (!entry || now >= entry.resetTime) {
    store.set(userId, {
      count: 1,
      resetTime: now + windowMs,
    })
    return { success: true, remaining: limit - 1 }
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0 }
  }

  entry.count++
  return { success: true, remaining: limit - entry.count }
}

/**
 * 检查速率限制
 * @param userId 用户标识
 * @param limit 窗口内最大请求次数
 * @param windowMs 窗口时长（毫秒）
 * @returns { success: 是否允许, remaining: 剩余次数 }
 */
export async function checkRateLimit(
  userId: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  // 生产环境硬阻断：首次调用时检查 Upstash 配置
  assertProductionConfig()

  // 生产模式：使用 Upstash 分布式限流
  if (useUpstash) {
    const windowSeconds = Math.ceil(windowMs / 1000)
    const ratelimit = getRatelimit(limit, windowSeconds)
    const { success, remaining } = await ratelimit.limit(userId)
    return { success, remaining }
  }

  // 本地降级模式：内存限流
  return checkRateLimitMemory(userId, limit, windowMs)
}
