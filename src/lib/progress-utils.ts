/**
 * 进度相关纯函数
 * 将按日聚合任务完成数的逻辑从 Route Handler 中剥离，便于单元测试
 */

/**
 * 按日期聚合每日完成任务数
 * 以 startDay 为起点，向后逐天统计 [dayStart, dayEnd) 区间内已完成任务的数量
 *
 * @param tasks 任务列表，每项包含截止日期与完成状态
 * @param startDay 起始日期（0 点），统计区间的第一天
 * @param days 需要聚合的天数
 * @returns 每日聚合结果，date 为 "月/日" 字符串，completed 为已完成任务数
 */
export function aggregateByDay(
  tasks: { dueDate: Date; isCompleted: boolean }[],
  startDay: Date,
  days: number
): { date: string; completed: number }[] {
  const result: { date: string; completed: number }[] = []
  for (let i = 0; i < days; i++) {
    const dayStart = new Date(startDay.getTime() + i * 86400000)
    const dayEnd = new Date(dayStart.getTime() + 86400000)
    const dayStr = `${dayStart.getMonth() + 1}/${dayStart.getDate()}`
    const completed = tasks.filter(
      (t) => t.isCompleted && t.dueDate >= dayStart && t.dueDate < dayEnd
    ).length
    result.push({ date: dayStr, completed })
  }
  return result
}
