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
vi.mock("@/lib/env", () => ({
  env: {
    OPENAI_API_KEY: "test-key",
    OPENAI_BASE_URL: "https://api.test.com",
    OPENAI_MODEL: "test-model",
  },
}))

// Mock Vercel AI SDK — generate-roadmap 使用 generateObject（非 generateText）
// 使用 vi.hoisted 确保 mock 变量在 vi.mock 工厂函数执行前已初始化
const { mockGenerateObject, mockCreateOpenAI } = vi.hoisted(() => ({
  mockGenerateObject: vi.fn(),
  mockCreateOpenAI: vi.fn(),
}))

vi.mock("ai", () => ({
  generateObject: mockGenerateObject,
}))

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: mockCreateOpenAI,
}))

const TEST_USER_ID = "user-test-001"

// AI 生成的 3 阶段路线图 Mock 数据
const mockStages = [
  {
    title: "基础夯实期",
    description: "打牢专业基础",
    actions: ["学好核心课程", "参加学术讲座", "阅读专业书籍"],
  },
  {
    title: "能力提升期",
    description: "拓展综合能力",
    actions: ["参与项目实践", "考取专业证书", "参加竞赛活动"],
  },
  {
    title: "冲刺突破期",
    description: "聚焦目标冲刺",
    actions: ["实习积累经验", "完善作品集", "准备面试求职"],
  },
]

beforeEach(() => {
  authMock.logout()
  rateLimitMock.reset()
  mockGenerateObject.mockReset()
  mockCreateOpenAI.mockReset()
  // createOpenAI 默认返回一个函数，该函数返回 mock model
  mockCreateOpenAI.mockReturnValue(() => "mock-model")
})

// ============================================
// POST /api/generate-roadmap — AI 路线图生成
// ============================================
describe("POST /api/generate-roadmap", () => {
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

  describe("场景 1：成功生成路线图并正确计算当前阶段", () => {
    beforeEach(() => {
      authMock.loginAs(TEST_USER_ID)
    })

    it("AI 生成成功返回 200，阶段列表完整，currentStageIndex 正确反映 60% 进度（第 2 阶段）", async () => {
      // Mock generateObject 返回包含 3 个阶段的路线图
      mockGenerateObject.mockResolvedValue({ object: { stages: mockStages } })

      // Mock plan 查询：用户已有 plan 和 profile
      mockPrisma.plan.findFirst.mockResolvedValue({
        id: "plan-001",
        userId: TEST_USER_ID,
        content: "我的大学规划内容",
        user: {
          profile: {
            major: "计算机科学",
            grade: "大二",
            degree: "本科",
            goal: "全栈工程师",
          },
        },
      })

      // Mock roadmap 不存在（首次生成走 create）
      mockPrisma.roadmap.findUnique.mockResolvedValue(null)
      mockPrisma.roadmap.create.mockResolvedValue({
        id: "roadmap-001",
        planId: "plan-001",
        stages: { stages: mockStages },
      })

      // Mock 任务进度：10 个任务，已完成 6 个，完成率 60%
      // computeCurrentStageIndex(3, 6, 10) → floor(0.6 * 2) = floor(1.2) = 1 → 第 2 阶段（索引 1）
      mockPrisma.dailyTask.count
        .mockResolvedValueOnce(6)  // completedCount
        .mockResolvedValueOnce(10) // totalCount

      const res = await POST()
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      // AI 生成的阶段列表完整
      expect(body.data.data.stages).toHaveLength(3)
      expect(body.data.data.stages[0].title).toBe("基础夯实期")
      expect(body.data.data.stages[1].title).toBe("能力提升期")
      expect(body.data.data.stages[2].title).toBe("冲刺突破期")
      // 关键断言：60% 进度对应第 2 阶段（索引 1）
      expect(body.data.currentStageIndex).toBe(1)
      // roadmap.create 被调用 1 次
      expect(mockPrisma.roadmap.create).toHaveBeenCalledTimes(1)
    })

    it("已有路线图时走 update 而非 create", async () => {
      mockGenerateObject.mockResolvedValue({ object: { stages: mockStages } })

      mockPrisma.plan.findFirst.mockResolvedValue({
        id: "plan-001",
        userId: TEST_USER_ID,
        content: "我的大学规划内容",
        user: { profile: { major: "计算机科学", grade: "大三", degree: "本科", goal: "后端工程师" } },
      })

      // Mock roadmap 已存在（走 update）
      mockPrisma.roadmap.findUnique.mockResolvedValue({
        id: "roadmap-001",
        planId: "plan-001",
        stages: { stages: mockStages },
      })
      mockPrisma.roadmap.update.mockResolvedValue({
        id: "roadmap-001",
        planId: "plan-001",
        stages: { stages: mockStages },
      })

      // 无任务时进度为 0，currentStageIndex = 0
      mockPrisma.dailyTask.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)

      const res = await POST()
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.currentStageIndex).toBe(0)
      // 关键：已有路线图走 update
      expect(mockPrisma.roadmap.update).toHaveBeenCalledTimes(1)
      expect(mockPrisma.roadmap.create).not.toHaveBeenCalled()
    })
  })

  describe("场景 2：AI 生成失败或返回无效结构", () => {
    beforeEach(() => {
      authMock.loginAs(TEST_USER_ID)
    })

    it("AI SDK 抛出 schema 校验异常时返回 AI_GENERATION_FAILED (502)，roadmap 不被创建", async () => {
      mockGenerateObject.mockRejectedValue(new Error("schema validation failed"))

      mockPrisma.plan.findFirst.mockResolvedValue({
        id: "plan-001",
        userId: TEST_USER_ID,
        content: "我的大学规划内容",
        user: { profile: null },
      })

      const res = await POST()
      const body = await res.json()

      expect(res.status).toBe(502)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe("AI_GENERATION_FAILED")
      // 关键：AI 失败时 roadmap 不应被创建
      expect(mockPrisma.roadmap.create).not.toHaveBeenCalled()
      expect(mockPrisma.roadmap.update).not.toHaveBeenCalled()
    })

    it("AI SDK 抛出非 schema 类异常时返回 INTERNAL_ERROR (500)", async () => {
      mockGenerateObject.mockRejectedValue(new Error("AI service timeout"))

      mockPrisma.plan.findFirst.mockResolvedValue({
        id: "plan-001",
        userId: TEST_USER_ID,
        content: "我的大学规划内容",
        user: { profile: null },
      })

      const res = await POST()
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe("INTERNAL_ERROR")
    })

    it("无 Plan 时返回 VALIDATION_ERROR (400)", async () => {
      mockPrisma.plan.findFirst.mockResolvedValue(null)

      const res = await POST()
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe("VALIDATION_ERROR")
    })
  })
})
