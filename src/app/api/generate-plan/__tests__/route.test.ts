import { describe, it, expect, beforeEach, vi } from "vitest"
import { mockAuthFn, authMock } from "@/test/mocks/auth"
import { mockPrisma } from "@/test/mocks/prisma"
import { mockCheckRateLimit, rateLimitMock } from "@/test/mocks/rate-limit"
import { makeRequest } from "@/test/helpers/request"
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

// Mock Vercel AI SDK
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

// 符合 generatePlanSchema 的合法请求体
const validBody = {
  major: "计算机科学",
  grade: "大二",
  degree: "本科",
  goal: "成为全栈工程师",
  strengths: "逻辑思维强",
  weaknesses: "英语较弱",
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
// POST /api/generate-plan — AI 规划生成
// ============================================
describe("POST /api/generate-plan", () => {
  describe("场景 3：未登录用户拦截", () => {
    it("未登录返回 401", async () => {
      authMock.logout()

      const res = await POST(
        makeRequest("/api/generate-plan", { method: "POST", body: validBody })
      )
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe("UNAUTHORIZED")
    })
  })

  describe("场景 1：成功生成并保存规划", () => {
    beforeEach(() => {
      authMock.loginAs(TEST_USER_ID)
    })

    it("AI 生成成功返回 200，prisma.plan.create 被调用 1 次且包含 AI 内容", async () => {
      const aiText = "这是一份详细的大学规划方案..."
      mockGenerateText.mockResolvedValue({ text: aiText })
      mockPrisma.userProfile.upsert.mockResolvedValue({})
      mockPrisma.plan.create.mockResolvedValue({
        id: "plan-001",
        userId: TEST_USER_ID,
        content: aiText,
      })

      const res = await POST(
        makeRequest("/api/generate-plan", { method: "POST", body: validBody })
      )
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.plan).toBe(aiText)
      // 关键：plan.create 被调用 1 次，且传入 AI 生成的内容
      expect(mockPrisma.plan.create).toHaveBeenCalledTimes(1)
      const createArgs = mockPrisma.plan.create.mock.calls[0][0]
      expect(createArgs.data.userId).toBe(TEST_USER_ID)
      expect(createArgs.data.content).toBe(aiText)
    })
  })

  describe("场景 2：AI 生成失败（Zod 校验拦截 / AI 异常）", () => {
    beforeEach(() => {
      authMock.loginAs(TEST_USER_ID)
    })

    it("AI SDK 抛出异常时返回 AI_GENERATION_FAILED，prisma.plan.create 不被调用", async () => {
      mockGenerateText.mockRejectedValue(new Error("AI service unavailable"))

      const res = await POST(
        makeRequest("/api/generate-plan", { method: "POST", body: validBody })
      )
      const body = await res.json()

      expect(res.status).toBe(502)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe("AI_GENERATION_FAILED")
      // 关键：AI 失败时 create 不应被调用
      expect(mockPrisma.plan.create).not.toHaveBeenCalled()
    })
  })
})
