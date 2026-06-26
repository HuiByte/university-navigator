import { describe, it, expect } from "vitest"
import {
  getDayStart,
  getDayRange,
  getDayStartDaysAgo,
  DEFAULT_TIMEZONE,
} from "@/lib/date-utils"

/**
 * 时区感知边界工具单元测试
 *
 * 关键原则：所有断言基于 .getTime()（UTC 毫秒数）比较瞬时，
 * 不依赖运行时本地时区，也不依赖 toISOString 的字符串格式
 * （TZDate 会覆写 toISOString 返回带偏移的格式如 +08:00，但底层 UTC 瞬时正确）。
 * 因此在 UTC 运行时（Vercel）或东八区运行时（本地开发）下结果一致。
 *
 * 约定：Asia/Shanghai = UTC+8（无夏令时），所以 Shanghai 当日 0 点 = UTC 前一天 16:00。
 */

/** 断言实际时刻与期望的 UTC ISO 字符串表示同一瞬时 */
function expectSameInstant(actual: Date, expectedISOString: string): void {
  expect(actual.getTime()).toBe(new Date(expectedISOString).getTime())
}

describe("date-utils 时区感知边界", () => {
  describe("DEFAULT_TIMEZONE", () => {
    it("默认时区常量为 Asia/Shanghai", () => {
      expect(DEFAULT_TIMEZONE).toBe("Asia/Shanghai")
    })
  })

  describe("getDayStart", () => {
    it("东八区：UTC 00:00（北京 08:00）所在天 0 点 = UTC 前一天 16:00", () => {
      const ref = new Date("2026-06-26T00:00:00Z") // 北京 6/26 08:00
      expectSameInstant(getDayStart(ref, "Asia/Shanghai"), "2026-06-25T16:00:00.000Z")
    })

    it("东八区：UTC 15:59（北京 23:59）仍在当天，0 点 = 前一天 16:00Z", () => {
      const ref = new Date("2026-06-26T15:59:59Z") // 北京 6/26 23:59:59
      expectSameInstant(getDayStart(ref, "Asia/Shanghai"), "2026-06-25T16:00:00.000Z")
    })

    it("东八区跨天边界：UTC 16:00（北京次日 00:00）归入下一天，0 点 = 当天 16:00Z", () => {
      const ref = new Date("2026-06-26T16:00:00Z") // 北京 6/27 00:00
      expectSameInstant(getDayStart(ref, "Asia/Shanghai"), "2026-06-26T16:00:00.000Z")
    })

    it("UTC 时区：当日 0 点 = UTC 0 点", () => {
      const ref = new Date("2026-06-26T12:00:00Z")
      expectSameInstant(getDayStart(ref, "UTC"), "2026-06-26T00:00:00.000Z")
    })

    it("西五区冬令时（America/New_York, UTC-5）：当日 0 点 = UTC 05:00", () => {
      // 2026-01-15 处于 EST（UTC-5），纽约 0 点 = UTC 05:00
      const ref = new Date("2026-01-15T10:00:00Z") // 纽约 1/15 05:00
      expectSameInstant(getDayStart(ref, "America/New_York"), "2026-01-15T05:00:00.000Z")
    })

    it("默认时区（不传 timeZone）等价于 Asia/Shanghai", () => {
      const ref = new Date("2026-06-26T00:00:00Z")
      expect(getDayStart(ref).getTime()).toBe(
        getDayStart(ref, "Asia/Shanghai").getTime()
      )
    })

    it("返回值是 Date 实例（可兼容 Prisma / Date 类型）", () => {
      const ref = new Date("2026-06-26T00:00:00Z")
      expect(getDayStart(ref, "Asia/Shanghai")).toBeInstanceOf(Date)
    })

    it("非法 IANA 时区抛出错误", () => {
      const ref = new Date("2026-06-26T00:00:00Z")
      expect(() => getDayStart(ref, "Invalid/Zone")).toThrow()
    })

    it("空时区字符串抛出错误", () => {
      const ref = new Date("2026-06-26T00:00:00Z")
      expect(() => getDayStart(ref, "")).toThrow()
    })
  })

  describe("getDayRange", () => {
    it("东八区：返回 [当日0点, 次日0点) 半开区间，end = start + 24h", () => {
      const ref = new Date("2026-06-26T10:00:00Z") // 北京 6/26 18:00
      const { start, end } = getDayRange(ref, "Asia/Shanghai")
      expectSameInstant(start, "2026-06-25T16:00:00.000Z")
      expectSameInstant(end, "2026-06-26T16:00:00.000Z")
      expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000)
    })

    it("半开区间：reference 恰好等于次日 0 点时，应归入下一天", () => {
      // 北京 6/27 00:00 = 2026-06-26T16:00:00Z，应归入 6/27 而非 6/26
      const ref = new Date("2026-06-26T16:00:00Z")
      const { start, end } = getDayRange(ref, "Asia/Shanghai")
      expectSameInstant(start, "2026-06-26T16:00:00.000Z")
      expectSameInstant(end, "2026-06-27T16:00:00.000Z")
    })

    it("UTC 时区跨天边界：23:59:59 与 00:00:00 分属不同区间且首尾相接", () => {
      const lateRef = new Date("2026-06-26T23:59:59Z")
      const earlyRef = new Date("2026-06-27T00:00:00Z")
      const late = getDayRange(lateRef, "UTC")
      const early = getDayRange(earlyRef, "UTC")
      expectSameInstant(late.start, "2026-06-26T00:00:00.000Z")
      expectSameInstant(early.start, "2026-06-27T00:00:00.000Z")
      // 前一天的 end 等于后一天的 start（半开区间首尾相接，无重叠无遗漏）
      expect(late.end.getTime()).toBe(early.start.getTime())
    })

    it("默认时区（不传 timeZone）等价于 Asia/Shanghai", () => {
      const ref = new Date("2026-06-26T10:00:00Z")
      const def = getDayRange(ref)
      const explicit = getDayRange(ref, "Asia/Shanghai")
      expect(def.start.getTime()).toBe(explicit.start.getTime())
      expect(def.end.getTime()).toBe(explicit.end.getTime())
    })
  })

  describe("getDayStartDaysAgo", () => {
    it("东八区：6 天前的当日 0 点", () => {
      const ref = new Date("2026-06-26T10:00:00Z") // 北京 6/26 18:00，当天 0 点 = 6/25 16:00Z
      // 6 天前 = 6/20，0 点 = 6/19 16:00Z
      expectSameInstant(
        getDayStartDaysAgo(ref, 6, "Asia/Shanghai"),
        "2026-06-19T16:00:00.000Z"
      )
    })

    it("days=0 等价于 getDayStart", () => {
      const ref = new Date("2026-06-26T10:00:00Z")
      expect(getDayStartDaysAgo(ref, 0, "Asia/Shanghai").getTime()).toBe(
        getDayStart(ref, "Asia/Shanghai").getTime()
      )
    })

    it("跨月：5/31 的 1 天前 = 5/30", () => {
      const ref = new Date("2026-05-31T10:00:00Z") // 北京 5/31 18:00
      // 5/30 0 点北京 = 5/29 16:00Z
      expectSameInstant(
        getDayStartDaysAgo(ref, 1, "Asia/Shanghai"),
        "2026-05-29T16:00:00.000Z"
      )
    })

    it("跨年：1/1 的 1 天前 = 去年 12/31", () => {
      const ref = new Date("2026-01-01T10:00:00Z") // 北京 1/1 18:00
      // 12/31 0 点北京 = 12/30 16:00Z
      expectSameInstant(
        getDayStartDaysAgo(ref, 1, "Asia/Shanghai"),
        "2025-12-30T16:00:00.000Z"
      )
    })

    it("UTC 时区下 7 天前的当日 0 点", () => {
      const ref = new Date("2026-06-26T12:00:00Z")
      expectSameInstant(getDayStartDaysAgo(ref, 7, "UTC"), "2026-06-19T00:00:00.000Z")
    })
  })

  describe("多时区一致性对比", () => {
    it("同一 UTC 时刻在不同时区下可能落在不同日期", () => {
      // 2026-06-26T16:30:00Z：上海已是 6/27 00:30，纽约仍是 6/26 12:30（EDT 夏令时 UTC-4）
      const ref = new Date("2026-06-26T16:30:00Z")
      const shanghaiStart = getDayStart(ref, "Asia/Shanghai")
      const nyStart = getDayStart(ref, "America/New_York")
      // 上海归入 6/27（0 点 = 6/26 16:00Z）
      expectSameInstant(shanghaiStart, "2026-06-26T16:00:00.000Z")
      // 纽约归入 6/26（0 点 = 6/26 04:00Z，EDT 夏令时 UTC-4）
      expectSameInstant(nyStart, "2026-06-26T04:00:00.000Z")
      // 二者属于不同的"当地日"，UTC 时间戳不同
      expect(shanghaiStart.getTime()).not.toBe(nyStart.getTime())
    })
  })
})
