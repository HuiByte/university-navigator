/**
 * 时区感知的日期边界工具
 *
 * 解决 Serverless 环境（如 Vercel，Node 运行时默认 UTC 时区）下，
 * 用 `new Date()` + `getFullYear/getMonth/getDate` 计算"今日边界"会按 UTC 切日，
 * 导致东八区用户在 UTC 16:00（北京次日 00:00）后打卡/任务被算到"昨天"的问题。
 *
 * 基于 date-fns v4 + @date-fns/tz，按指定 IANA 时区计算当日 0 点对应的 UTC 时间戳。
 * 返回的 Date（TZDate 子类）可直接用于 Prisma 的 gte/lt 范围查询。
 */
import { startOfDay, addDays } from "date-fns"
import { tz } from "@date-fns/tz"

/** 默认时区：东八区（中国标准时间） */
export const DEFAULT_TIMEZONE = "Asia/Shanghai"

/** 半开区间 [start, end)：start 为当日 0 点（含），end 为次日 0 点（不含） */
export interface DayRange {
  start: Date
  end: Date
}

/**
 * 校验 IANA 时区字符串是否合法，非法时抛出错误
 * 避免传入拼写错误的时区导致 date-fns 静默使用错误计算结果
 */
function assertValidTimeZone(timeZone: string): void {
  if (!timeZone) {
    throw new Error("时区参数不能为空")
  }
  try {
    // Intl.DateTimeFormat 对非法 IANA 时区会抛 RangeError
    new Intl.DateTimeFormat("en-US", { timeZone })
  } catch {
    throw new Error(`无效的 IANA 时区: ${timeZone}`)
  }
}

/**
 * 获取指定时区下，参考时刻所在"天"的起始 0 点
 * 返回的 Date 其 UTC 时间戳 = 该时区当日 0 点对应的绝对时刻
 *
 * @param reference 参考时刻，默认当前时刻
 * @param timeZone IANA 时区，默认 Asia/Shanghai
 */
export function getDayStart(
  reference: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE
): Date {
  assertValidTimeZone(timeZone)
  return startOfDay(reference, { in: tz(timeZone) })
}

/**
 * 获取指定时区下，参考时刻所在"天"的 [start, end) 半开区间
 * start = 当日 0 点（含），end = 次日 0 点（不含）
 * 适用于 Prisma 的 gte / lt 范围查询，避免使用 23:59:59.999 的闭区间
 *
 * @param reference 参考时刻，默认当前时刻
 * @param timeZone IANA 时区，默认 Asia/Shanghai
 */
export function getDayRange(
  reference: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE
): DayRange {
  assertValidTimeZone(timeZone)
  const ctx = tz(timeZone)
  const start = startOfDay(reference, { in: ctx })
  // 次日 0 点：对参考时刻加 1 天后取当日 0 点（用 startOfDay 而非 +24h，DST 安全）
  const end = startOfDay(addDays(reference, 1), { in: ctx })
  return { start, end }
}

/**
 * 获取指定时区下，参考时刻之前 N 天的当日 0 点
 * 用于"本周起始（6 天前）""上周起始（13 天前）""昨天（1 天前）"等场景
 *
 * @param reference 参考时刻
 * @param days 距参考时刻的天数（正数表示过去，0 表示当天）
 * @param timeZone IANA 时区，默认 Asia/Shanghai
 */
export function getDayStartDaysAgo(
  reference: Date,
  days: number,
  timeZone: string = DEFAULT_TIMEZONE
): Date {
  assertValidTimeZone(timeZone)
  return startOfDay(addDays(reference, -days), { in: tz(timeZone) })
}
