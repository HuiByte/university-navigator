import { describe, it, expect } from "vitest"
import { calculateStreak } from "@/lib/checkin-utils"

// 辅助：构造指定年月日的日期（0 点），JS 月份 0-based 故 m-1
function date(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d)
}

describe("calculateStreak", () => {
  it("首次打卡（无历史记录），返回 streak = 1", () => {
    const today = date(2024, 1, 15)
    expect(calculateStreak([], today)).toBe(1)
  })

  it("连续打卡 3 天，返回 streak = 3", () => {
    // 今天 1/15 + 昨天 1/14 + 前天 1/13 = 3 天连续
    const today = date(2024, 1, 15)
    const previous = [date(2024, 1, 14), date(2024, 1, 13)]
    expect(calculateStreak(previous, today)).toBe(3)
  })

  it("中断 1 天后重新打卡，streak 重置为 1", () => {
    // 今天 1/15，昨天 1/14 无记录（断档），前天 1/13 有记录但已不连续
    const today = date(2024, 1, 15)
    const previous = [date(2024, 1, 13), date(2024, 1, 12)]
    expect(calculateStreak(previous, today)).toBe(1)
  })

  it("跨月连续打卡，计算正确", () => {
    // 1/31 → 2/1 跨月连续：今天 2/1 + 昨天 1/31 + 前天 1/30 = 3 天
    const today = date(2024, 2, 1)
    const previous = [date(2024, 1, 31), date(2024, 1, 30)]
    expect(calculateStreak(previous, today)).toBe(3)
  })

  it("跨年连续打卡，计算正确", () => {
    // 2023/12/31 → 2024/1/1 跨年连续：今天 1/1 + 昨天 12/31 + 前天 12/30 = 3 天
    const today = date(2024, 1, 1)
    const previous = [date(2023, 12, 31), date(2023, 12, 30)]
    expect(calculateStreak(previous, today)).toBe(3)
  })
})
