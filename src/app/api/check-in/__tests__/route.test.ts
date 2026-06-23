import { describe, it, expect, beforeEach, vi } from "vitest"
import { mockAuthFn, authMock } from "@/test/mocks/auth"
import { mockPrisma } from "@/test/mocks/prisma"
import { mockCheckRateLimit, rateLimitMock } from "@/test/mocks/rate-limit"
import { POST } from "../route"

// vi.mock 必须在测试文件顶层调用（Vitest 会将其 hoist 到文件顶部）
// 工厂函数中引用的变量必须以 mock 开头（Vitest hoisting 例外规则）
vi.mock("@/auth", () => ({
  auth: mockAuthFn,
}))
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
}))

const TEST_USER_ID = "user-test-001"

beforeEach(() => {
  authMock.logout()
  rateLimitMock.reset()
})

// ============================================
// POST /api/check-in — 每日打卡
// ============================================
describe("POST /api/check-in", () => {
  describe("场景 3：未登录用户拦截", () => {
    it("未登录返回 401", async () => {
      authMock.logout()

      const res = await POST()
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe("UNAUTHORIZED")
    })
  })

  describe("场景 2：拦截重复打卡（同一天）", () => {
    beforeEach(() => {
      authMock.loginAs(TEST_USER_ID)
    })

    it("今天已打卡时返回 409 和 ALREADY_CHECKED_IN，不执行 create", async () => {
      const existingCheckIn = {
        id: "checkin-001",
        userId: TEST_USER_ID,
        date: new Date(),
        streakCount: 5,
      }
      mockPrisma.checkInRecord.findUnique.mockResolvedValue(existingCheckIn)

      const res = await POST()
      const body = await res.json()

      expect(res.status).toBe(409)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe("ALREADY_CHECKED_IN")
      // 关键：create 不应被调用
      expect(mockPrisma.checkInRecord.create).not.toHaveBeenCalled()
    })
  })

  describe("场景 1：成功打卡并正确计算 streak", () => {
    beforeEach(() => {
      authMock.loginAs(TEST_USER_ID)
    })

    it("首次打卡（无历史）返回 201 且 streak 为 1", async () => {
      // 今天未打卡
      mockPrisma.checkInRecord.findUnique.mockResolvedValue(null)
      // 无历史记录
      mockPrisma.checkInRecord.findMany.mockResolvedValue([])
      mockPrisma.checkInRecord.create.mockResolvedValue({
        id: "checkin-new",
        userId: TEST_USER_ID,
        date: new Date(),
        streakCount: 1,
      })

      const res = await POST()
      const body = await res.json()

      expect(res.status).toBe(201)
      expect(body.success).toBe(true)
      expect(body.data.streak).toBe(1)
      expect(mockPrisma.checkInRecord.create).toHaveBeenCalledTimes(1)
    })

    it("昨天有打卡记录时 streak 为 2，create 被调用 1 次", async () => {
      // 今天未打卡
      mockPrisma.checkInRecord.findUnique.mockResolvedValue(null)

      // 构造昨天的日期（归一化到 0 点，与 calculateStreak 逻辑一致）
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      yesterday.setHours(0, 0, 0, 0)

      // findMany 返回包含昨天日期的记录
      mockPrisma.checkInRecord.findMany.mockResolvedValue([{ date: yesterday }])

      mockPrisma.checkInRecord.create.mockResolvedValue({
        id: "checkin-new",
        userId: TEST_USER_ID,
        date: new Date(),
        streakCount: 2,
      })

      const res = await POST()
      const body = await res.json()

      expect(res.status).toBe(201)
      expect(body.success).toBe(true)
      expect(body.data.streak).toBe(2)
      expect(mockPrisma.checkInRecord.create).toHaveBeenCalledTimes(1)
    })
  })
})
