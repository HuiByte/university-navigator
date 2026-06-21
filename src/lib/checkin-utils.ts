/**
 * 打卡相关纯函数
 * 将连续打卡天数（streak）计算逻辑从 Route Handler 中剥离，便于单元测试
 */

/**
 * 将日期归一化到当天 0 点，便于按天比较
 */
function normalizeToDate(d: Date): Date {
  const normalized = new Date(d)
  normalized.setHours(0, 0, 0, 0)
  return normalized
}

/**
 * 计算连续打卡天数
 * 从 referenceDate 起向前回溯，统计连续有打卡记录的天数（含 referenceDate 当天）
 *
 * 算法：referenceDate 当天计 1 天，随后从昨天起逐日回溯，
 * 遇到打卡记录则累加，遇到断档立即停止。
 *
 * @param previousCheckIns 历史打卡日期列表（不含 referenceDate 当天）
 * @param referenceDate 参考日期（通常为今天），默认取当前时间
 * @returns 连续打卡天数，referenceDate 当天打卡算 1
 */
export function calculateStreak(
  previousCheckIns: Date[],
  referenceDate: Date = new Date()
): number {
  // 将历史打卡日期归一化到 0 点，用时间戳集合便于 O(1) 查找
  const checkInDays = new Set(
    previousCheckIns.map((d) => normalizeToDate(d).getTime())
  )

  const today = normalizeToDate(referenceDate)
  let streak = 1 // referenceDate 当天打卡算 1 天

  // 从昨天起向前回溯，遇到断档即停止
  const cursor = new Date(today)
  cursor.setDate(cursor.getDate() - 1)
  while (checkInDays.has(cursor.getTime())) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}
