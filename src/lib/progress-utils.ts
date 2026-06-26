/**
 * 进度相关纯函数
 * 将按日聚合任务完成数的逻辑从 Route Handler 中剥离，便于单元测试
 */
import { addDays, format } from "date-fns"
import { tz } from "@date-fns/tz"
import { DEFAULT_TIMEZONE } from "./date-utils"

/**
 * 按日期聚合每日完成任务数
 * 以 startDay 为起点，向后逐天统计 [dayStart, dayEnd) 区间内已完成任务的数量
 *
 * 时区处理：
 * - 桶划分用 addDays（DST 安全），而非 +24h 毫秒数
 * - 标签用 date-fns format 配合 tz 上下文，确保按用户时区显示"月/日"
 *   （避免 UTC 运行时 getMonth/getDate 按本地时区切日导致标签偏移一天）
 *
 * @param tasks 任务列表，每项包含截止日期与完成状态
 * @param startDay 起始日期（0 点），统计区间的第一天（应为时区感知的 0 点）
 * @param days 需要聚合的天数
 * @param timeZone IANA 时区，默认 Asia/Shanghai
 * @returns 每日聚合结果，date 为 "月/日" 字符串，completed 为已完成任务数
 */
export function aggregateByDay(
  tasks: { dueDate: Date; isCompleted: boolean }[],
  startDay: Date,
  days: number,
  timeZone: string = DEFAULT_TIMEZONE
): { date: string; completed: number }[] {
  const ctx = tz(timeZone)
  const result: { date: string; completed: number }[] = []
  for (let i = 0; i < days; i++) {
    // 第 i 天的 0 点与次日 0 点（用 addDays 而非 +24h 毫秒数，DST 安全）
    const dayStart = addDays(startDay, i)
    const dayEnd = addDays(startDay, i + 1)
    // 标签按用户时区格式化为 "M/d"，避免运行时本地时区导致的日期偏移
    const dayStr = format(dayStart, "M/d", { in: ctx })
    const completed = tasks.filter(
      (t) => t.isCompleted && t.dueDate >= dayStart && t.dueDate < dayEnd
    ).length
    result.push({ date: dayStr, completed })
  }
  return result
}
