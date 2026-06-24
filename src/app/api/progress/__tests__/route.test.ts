import { describe, it, expect, beforeEach, vi } from "vitest"
import { mockAuthFn, authMock } from "@/test/mocks/auth"
import { mockPrisma } from "@/test/mocks/prisma"
import { GET } from "../route"

// vi.mock 必须在测试文件顶层调用（Vitest 会将其 hoist 到文件顶部）
// 工厂函数中引用的变量必须以 mock 开头（Vitest hoisting 例外规则）
vi.mock("@/auth", () => ({
  auth: mockAuthFn,
}))
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const TEST_USER_ID = "user-test-001"

// 测试用假数据
const mockLatestCheckIn = {
  id: "checkin-latest",
  userId: TEST_USER_ID,
  date: new Date(),
  streakCount: 5,
}

beforeEach(() => {
  authMock.logout()
})

// ============================================
// GET /api/progress — 获取进度数据
// ============================================
describe("GET /api/progress", () => {
  describe("鉴权", () => {
    it("未登录返回 401", async () => {
      authMock.logout()

      const res = await GET()
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe("UNAUTHORIZED")
    })
  })

  describe("正常获取数据", () => {
    beforeEach(() => {
      authMock.loginAs(TEST_USER_ID)
    })

    it("返回 200 且包含完整的进度数据结构", async () => {
      // 模拟基础统计数据
      mockPrisma.checkInRecord.count.mockResolvedValue(10)

      // 已完成任务数 & 总任务数（在 Promise.all 中按序调用）
      mockPrisma.dailyTask.count.mockResolvedValueOnce(5) // completed
      mockPrisma.dailyTask.count.mockResolvedValueOnce(10) // total

      // 最新打卡记录（用于连续天数）
      mockPrisma.checkInRecord.findFirst.mockResolvedValue(mockLatestCheckIn)

      // 本周 & 上周任务（在 Promise.all 中按序调用）
      const today = new Date()
      const mockTaskDone = { id: "t-1", userId: TEST_USER_ID, title: "任务1", description: "", isCompleted: true, priority: 1, estimatedMinutes: 30, dueDate: today, roadmapId: null, stageIndex: null }
      const mockTaskPending = { id: "t-2", userId: TEST_USER_ID, title: "任务2", description: "", isCompleted: false, priority: 2, estimatedMinutes: 30, dueDate: today, roadmapId: null, stageIndex: null }
      mockPrisma.dailyTask.findMany.mockResolvedValueOnce([mockTaskDone, mockTaskPending]) // thisWeek
      mockPrisma.dailyTask.findMany.mockResolvedValueOnce([]) // lastWeek

      const res = await GET()
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)

      // 验证基础统计字段
      expect(body.data.totalStudyDays).toBe(10)
      expect(body.data.completedTasks).toBe(5)
      expect(body.data.totalTasks).toBe(10)
      expect(body.data.completionRate).toBe(50)

      // 验证连续打卡天数（最新打卡在今天，streakCount 应被采纳）
      expect(body.data.currentStreak).toBe(5)

      // 验证趋势数据结构
      expect(body.data.trendData).toBeInstanceOf(Array)
      expect(body.data.trendData).toHaveLength(7) // 7 天趋势
      expect(body.data.trendData[0]).toHaveProperty("date")
      expect(body.data.trendData[0]).toHaveProperty("thisWeek")
      expect(body.data.trendData[0]).toHaveProperty("lastWeek")

      // 验证 thisWeek 首天可能有已完成任务，lastWeek 为 0
      expect(body.data.trendData[0].thisWeek).toBeGreaterThanOrEqual(0)
      expect(body.data.trendData[0].lastWeek).toBe(0)
    })

    it("无数据时返回空趋势数组和零值", async () => {
      authMock.loginAs(TEST_USER_ID)

      // 全部无数据
      mockPrisma.checkInRecord.count.mockResolvedValue(0)
      mockPrisma.dailyTask.count.mockResolvedValueOnce(0) // completed
      mockPrisma.dailyTask.count.mockResolvedValueOnce(0) // total
      mockPrisma.checkInRecord.findFirst.mockResolvedValue(null)
      mockPrisma.dailyTask.findMany.mockResolvedValueOnce([]) // thisWeek
      mockPrisma.dailyTask.findMany.mockResolvedValueOnce([]) // lastWeek

      const res = await GET()
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.totalStudyDays).toBe(0)
      expect(body.data.completedTasks).toBe(0)
      expect(body.data.totalTasks).toBe(0)
      expect(body.data.completionRate).toBe(0)
      expect(body.data.currentStreak).toBe(0)
      expect(body.data.trendData).toBeInstanceOf(Array)
      expect(body.data.trendData).toHaveLength(7)
    })

    it("completionRate 正确四舍五入", async () => {
      authMock.loginAs(TEST_USER_ID)

      mockPrisma.checkInRecord.count.mockResolvedValue(5)
      mockPrisma.dailyTask.count.mockResolvedValueOnce(1) // completed
      mockPrisma.dailyTask.count.mockResolvedValueOnce(3) // total → 1/3 ≈ 33.3% → 33
      mockPrisma.checkInRecord.findFirst.mockResolvedValue(null)
      mockPrisma.dailyTask.findMany.mockResolvedValueOnce([]) // thisWeek
      mockPrisma.dailyTask.findMany.mockResolvedValueOnce([]) // lastWeek

      const res = await GET()
      const body = await res.json()

      expect(body.data.completionRate).toBe(33)
    })

    it("超过一天未打卡时 currentStreak 为 0", async () => {
      authMock.loginAs(TEST_USER_ID)

      // 最新打卡在 3 天前 — 断签
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

      mockPrisma.checkInRecord.count.mockResolvedValue(5)
      mockPrisma.dailyTask.count.mockResolvedValueOnce(2)
      mockPrisma.dailyTask.count.mockResolvedValueOnce(5)
      mockPrisma.checkInRecord.findFirst.mockResolvedValue({
        ...mockLatestCheckIn,
        date: threeDaysAgo,
      })
      mockPrisma.dailyTask.findMany.mockResolvedValueOnce([])
      mockPrisma.dailyTask.findMany.mockResolvedValueOnce([])

      const res = await GET()
      const body = await res.json()

      expect(body.data.currentStreak).toBe(0)
    })
  })

  describe("异常处理", () => {
    it("Prisma 数据库异常时返回 500", async () => {
      authMock.loginAs(TEST_USER_ID)
      mockPrisma.checkInRecord.count.mockRejectedValue(new Error("DB connection lost"))

      const res = await GET()
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe("INTERNAL_ERROR")
    })
  })
})