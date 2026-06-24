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

// Mock Vercel AI SDK — generate-roadmap 使用 generateText + 手动 JSON 解析（非 generateObject）
// 使用 vi.hoisted 确保 mock 变量在 vi.mock 工厂函数执行前已初始化
const { mockGenerateText, mockCreateOpenAI } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockCreateOpenAI: vi.fn(),
}))

vi.mock("ai", () => ({
  generateText: mockGenerateText,
}))

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: mockCreateOpenAI,
}))

const TEST_USER_ID = "user-test-001"

// AI 生成的 3 阶段路线图 Mock 数据（字段与 RoadmapSchema 对齐）
const mockStages = [
  {
    title: "基础夯实期",
    duration: "大一上学期",
    goal: "打牢专业基础",
    actions: ["学好核心课程", "参加学术讲座", "阅读专业书籍"],
  },
  {
    title: "能力提升期",
    duration: "大一下学期至大二",
    goal: "拓展综合能力",
    actions: ["参与项目实践", "考取专业证书", "参加竞赛活动"],
  },
  {
    title: "冲刺突破期",
    duration: "大三至大四",
    goal: "聚焦目标冲刺",
    actions: ["实习积累经验", "完善作品集", "准备面试求职"],
  },
]

const mockRisks = ["基础不牢导致后续学习困难", "缺乏实践影响就业竞争力"]
const mockSuggestions = ["制定每日学习计划", "积极参与课外实践"]

// 完整的 Plan mock 数据（包含 version/status/archivedAt 字段）
const mockPlanBase = {
  id: "plan-001",
  createdAt: new Date(),
  userId: TEST_USER_ID,
  content: "我的大学规划内容",
  version: 1,
  status: "ACTIVE" as const,
  archivedAt: null,
}

// 完整的 Roadmap mock 数据
const mockRoadmapBase = {
  id: "roadmap-001",
  planId: "plan-001",
  stages: { stages: mockStages, risks: mockRisks, suggestions: mockSuggestions },
  version: 1,
  status: "ACTIVE" as const,
  archivedAt: null,
  createdAt: new Date(),
}

beforeEach(() => {
  authMock.logout()
  rateLimitMock.reset()
  mockGenerateText.mockReset()
  mockCreateOpenAI.mockReset()
  // createOpenAI 默认返回带 .chat() 方法的对象，与路由中 openai.chat(model) 调用方式匹配
  mockCreateOpenAI.mockReturnValue({ chat: () => "mock-model" })
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

  describe("场景 1：成功生成路线图并自动创建 DailyTask", () => {
    beforeEach(() => {
      authMock.loginAs(TEST_USER_ID)
    })

    it("首次生成：创建新 Roadmap + 批量生成当前阶段的 DailyTask", async () => {
      // Mock generateText 返回包含 JSON 的文本（markdown 代码块包裹，测试解析逻辑）
      const mockJsonResponse = JSON.stringify({ stages: mockStages, risks: mockRisks, suggestions: mockSuggestions })
      const mockText = `\`\`\`json\n${mockJsonResponse}\n\`\`\``
      mockGenerateText.mockResolvedValue({ text: mockText })

      // Mock plan 查询：用户已有 plan 和 profile
      mockPrisma.plan.findFirst.mockResolvedValue({
        ...mockPlanBase,
        user: {
          profile: {
            major: "计算机科学",
            grade: "大二",
            degree: "本科",
            goal: "全栈工程师",
          },
        },
      } as any)

      // Mock roadmap 不存在（首次生成）
      mockPrisma.roadmap.findFirst.mockResolvedValue(null)

      // Mock $transaction：执行回调函数
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        // 模拟事务内的 tx 对象，代理到 mockPrisma
        const tx = {
          roadmap: mockPrisma.roadmap,
          dailyTask: mockPrisma.dailyTask,
        }
        return fn(tx)
      })

      // Mock 事务内 roadmap.create 返回值
      mockPrisma.roadmap.create.mockResolvedValue({
        ...mockRoadmapBase,
        id: "roadmap-new-001",
      })

      // Mock dailyTask.createMany
      mockPrisma.dailyTask.createMany.mockResolvedValue({ count: 3 })

      // Mock 任务进度（resolveCurrentStageIndex 在事务外不再被调用，
      // 但 POST handler 中 currentStageIndex 直接设为 0）
      mockPrisma.dailyTask.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)

      const res = await POST()
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      // AI 生成的阶段列表完整
      expect(body.data.data.stages).toHaveLength(3)
      // 首次生成 currentStageIndex = 0
      expect(body.data.currentStageIndex).toBe(0)

      // 关键断言：$transaction 被调用
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)

      // 关键断言：roadmap.create 被调用（在事务内）
      expect(mockPrisma.roadmap.create).toHaveBeenCalledTimes(1)
      const createArgs = mockPrisma.roadmap.create.mock.calls[0][0]
      expect(createArgs.data.planId).toBe("plan-001")
      expect(createArgs.data.version).toBe(1)
      expect(createArgs.data.status).toBe("ACTIVE")

      // 关键断言：dailyTask.createMany 被调用，传入当前阶段的 actions
      expect(mockPrisma.dailyTask.createMany).toHaveBeenCalledTimes(1)
      const createManyArgs = mockPrisma.dailyTask.createMany.mock.calls[0][0] as any
      expect(createManyArgs.data).toHaveLength(3) // 第一阶段有 3 个 actions
      expect(createManyArgs.data[0].title).toBe("学好核心课程")
      expect(createManyArgs.data[0].roadmapId).toBe("roadmap-new-001")
      expect(createManyArgs.data[0].stageIndex).toBe(0)
      expect(createManyArgs.data[0].userId).toBe(TEST_USER_ID)
      expect(createManyArgs.data[0].priority).toBe(3) // 3 - 0 = 3
      expect(createManyArgs.data[0].estimatedMinutes).toBe(60)
      expect(createManyArgs.data[0].isCompleted).toBe(false)

      // 首次生成不应有归档和清理操作
      expect(mockPrisma.roadmap.update).not.toHaveBeenCalled()
      expect(mockPrisma.dailyTask.deleteMany).not.toHaveBeenCalled()
    })

    it("重新生成：归档旧 Roadmap + 清理旧未完成任务 + 创建新 Roadmap + 生成新 DailyTask", async () => {
      const mockJsonResponse = JSON.stringify({ stages: mockStages, risks: mockRisks, suggestions: mockSuggestions })
      mockGenerateText.mockResolvedValue({ text: mockJsonResponse })

      mockPrisma.plan.findFirst.mockResolvedValue({
        ...mockPlanBase,
        user: { profile: { major: "计算机科学", grade: "大三", degree: "本科", goal: "后端工程师" } },
      } as any)

      // Mock roadmap 已存在（走归档+重建）
      mockPrisma.roadmap.findFirst.mockResolvedValue({
        ...mockRoadmapBase,
        id: "roadmap-old-001",
        version: 1,
      })

      // Mock $transaction
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          roadmap: mockPrisma.roadmap,
          dailyTask: mockPrisma.dailyTask,
        }
        return fn(tx)
      })

      mockPrisma.roadmap.update.mockResolvedValue({
        ...mockRoadmapBase,
        id: "roadmap-old-001",
        status: "ARCHIVED",
      })
      mockPrisma.roadmap.create.mockResolvedValue({
        ...mockRoadmapBase,
        id: "roadmap-new-002",
        version: 2,
      })
      mockPrisma.dailyTask.deleteMany.mockResolvedValue({ count: 2 })
      mockPrisma.dailyTask.createMany.mockResolvedValue({ count: 3 })

      const res = await POST()
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)

      // 关键断言：$transaction 被调用
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)

      // 关键断言：旧 Roadmap 被归档
      expect(mockPrisma.roadmap.update).toHaveBeenCalledTimes(1)
      const updateArgs = mockPrisma.roadmap.update.mock.calls[0][0]
      expect(updateArgs.where.id).toBe("roadmap-old-001")
      expect(updateArgs.data.status).toBe("ARCHIVED")
      expect(updateArgs.data.archivedAt).toBeDefined()

      // 关键断言：旧未完成任务被清理
      expect(mockPrisma.dailyTask.deleteMany).toHaveBeenCalledTimes(1)
      const deleteArgs = mockPrisma.dailyTask.deleteMany.mock.calls[0][0] as any
      expect(deleteArgs.where.roadmapId).toBe("roadmap-old-001")
      expect(deleteArgs.where.isCompleted).toBe(false)

      // 关键断言：新 Roadmap 版本递增
      expect(mockPrisma.roadmap.create).toHaveBeenCalledTimes(1)
      const createArgs = mockPrisma.roadmap.create.mock.calls[0][0]
      expect(createArgs.data.version).toBe(2)

      // 关键断言：新 DailyTask 关联新 Roadmap
      expect(mockPrisma.dailyTask.createMany).toHaveBeenCalledTimes(1)
      const createManyArgs = mockPrisma.dailyTask.createMany.mock.calls[0][0] as any
      expect(createManyArgs.data[0].roadmapId).toBe("roadmap-new-002")
      expect(createManyArgs.data[0].stageIndex).toBe(0)
    })
  })

  describe("场景 2：AI 生成失败或返回无效结构", () => {
    beforeEach(() => {
      authMock.loginAs(TEST_USER_ID)
    })

    it("AI SDK 抛出 schema 校验异常时返回 AI_GENERATION_FAILED (502)，roadmap 不被创建", async () => {
      mockGenerateText.mockRejectedValue(new Error("schema validation failed"))

      mockPrisma.plan.findFirst.mockResolvedValue({
        ...mockPlanBase,
        user: { profile: null },
      } as any)

      const res = await POST()
      const body = await res.json()

      expect(res.status).toBe(502)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe("AI_GENERATION_FAILED")
      // 关键：AI 失败时 roadmap 不应被创建，事务不应执行
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
      expect(mockPrisma.roadmap.create).not.toHaveBeenCalled()
    })

    it("AI SDK 抛出非 schema 类异常时返回 INTERNAL_ERROR (500)", async () => {
      mockGenerateText.mockRejectedValue(new Error("AI service timeout"))

      mockPrisma.plan.findFirst.mockResolvedValue({
        ...mockPlanBase,
        user: { profile: null },
      } as any)

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
