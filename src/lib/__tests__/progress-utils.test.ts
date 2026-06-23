import { describe, it, expect } from "vitest"
import { aggregateByDay } from "@/lib/progress-utils"

// 辅助：构造指定年月日的日期（0 点），JS 月份 0-based 故 m-1
function date(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d)
}

describe("aggregateByDay", () => {
  it("正常聚合多条跨天记录", () => {
    // 起始日 1/10，统计 3 天；每天各 1 条已完成任务
    const start = date(2024, 1, 10)
    const tasks = [
      { dueDate: date(2024, 1, 10), isCompleted: true },
      { dueDate: date(2024, 1, 11), isCompleted: true },
      { dueDate: date(2024, 1, 12), isCompleted: true },
    ]
    const result = aggregateByDay(tasks, start, 3)
    expect(result).toEqual([
      { date: "1/10", completed: 1 },
      { date: "1/11", completed: 1 },
      { date: "1/12", completed: 1 },
    ])
  })

  it("输入为空数组，每日 completed 均为 0", () => {
    const start = date(2024, 1, 10)
    const result = aggregateByDay([], start, 3)
    expect(result).toHaveLength(3)
    expect(result.every((item) => item.completed === 0)).toBe(true)
  })

  it("同一天多条记录合并计算", () => {
    // 1/10 当天 3 条已完成 + 1 条未完成，应只统计已完成的 3 条
    const start = date(2024, 1, 10)
    const tasks = [
      { dueDate: date(2024, 1, 10), isCompleted: true },
      { dueDate: date(2024, 1, 10), isCompleted: true },
      { dueDate: date(2024, 1, 10), isCompleted: true },
      { dueDate: date(2024, 1, 10), isCompleted: false },
    ]
    const result = aggregateByDay(tasks, start, 1)
    expect(result).toEqual([{ date: "1/10", completed: 3 }])
  })
})
