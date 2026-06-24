import { describe, it, expect, beforeEach, vi } from "vitest"
import { mockAuthFn, authMock } from "@/test/mocks/auth"
import { mockPrisma } from "@/test/mocks/prisma"
import { mockCheckRateLimit, rateLimitMock } from "@/test/mocks/rate-limit"
import { mockStreamText, aiMock } from "@/test/mocks/ai"
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
    DATABASE_URL: "test-db-url",
    OPENAI_API_KEY: "test-key",
    OPENAI_BASE_URL: "https://api.openai.com/v1",
    OPENAI_MODEL: "gpt-4-test",
    AUTH_GITHUB_ID: "test-github-id",
    AUTH_GITHUB_SECRET: "test-github-secret",
    AUTH_SECRET: "test-secret",
  },
}))
// 注意：ai 模块必须在顶部 vi.mock 块中 mock streamText
vi.mock("ai", () => ({
  streamText: mockStreamText,
}))

const TEST_USER_ID = "user-test-001"

beforeEach(() => {
  authMock.logout()
  rateLimitMock.reset()
  aiMock.reset()
})

// ============================================
// POST /api/progress/ai-summary — AI 周报总结
// ============================================
describe("POST /api/progress/ai-summary", () => {
  describe("鉴权", () => {
    it("未登录返回 401", async () => {
      authMock.logout()

      const res = await POST()
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe("UNAUTHORIZED")
    })
  })

  describe("限流", () => {
    it("触发限流返回 429", async () => {
      authMock.loginAs(TEST_USER_ID)
      rateLimitMock.setRateLimited()

      const res = await POST()
      const body = await res.json()

      expect(res.status).toBe(429)
      expect(body.error.code).toBe("RATE_LIMIT_EXCEEDED")
      expect(res.headers.get("Retry-After")).toBe("60")
    })
  })

  describe("成功生成周报", () => {
    beforeEach(() => {
      authMock.loginAs(TEST_USER_ID)
    })

    it("返回 200 且 Content-Type 包含 text/plain（流式文本）", async () => {
      // 提供本周数据
      mockPrisma.checkInRecord.count.mockResolvedValue(3)
      mockPrisma.dailyTask.findMany.mockResolvedValue([
        { isCompleted: true },
        { isCompleted: true },
        { isCompleted: false },
      ])
      // 总计：completed=5, total=10
      mockPrisma.dailyTask.count.mockResolvedValueOnce(5)
      mockPrisma.dailyTask.count.mockResolvedValueOnce(10)

      const res = await POST()

      expect(res.status).toBe(200)
      expect(res.headers.get("Content-Type")).toContain("text/plain")
    })

    it("streamText 被调用，且传入正确的 system prompt", async () => {
      mockPrisma.checkInRecord.count.mockResolvedValue(3)
      mockPrisma.dailyTask.findMany.mockResolvedValue([
        { isCompleted: true },
        { isCompleted: true },
        { isCompleted: false },
      ])
      mockPrisma.dailyTask.count.mockResolvedValueOnce(5)
      mockPrisma.dailyTask.count.mockResolvedValueOnce(10)

      await POST()

      expect(mockStreamText).toHaveBeenCalledTimes(1)
      const callArg = mockStreamText.mock.calls[0][0]!
      // system prompt 应包含关键字段
      expect(callArg.system).toContain("AI 学长")
      expect(callArg.system).toContain("本周数据")
      // prompt 应为中文请求
      expect(callArg.prompt).toContain("本周学习数据")
      // abortSignal 应存在（超时保护）
      expect(callArg.abortSignal).toBeDefined()
    })
  })

  describe("AI 调用异常处理", () => {
    beforeEach(() => {
      authMock.loginAs(TEST_USER_ID)

      mockPrisma.checkInRecord.count.mockResolvedValue(0)
      mockPrisma.dailyTask.findMany.mockResolvedValue([])
      mockPrisma.dailyTask.count.mockResolvedValueOnce(0)
      mockPrisma.dailyTask.count.mockResolvedValueOnce(0)
    })

    it("AI 服务超时（AbortError）返回 504", async () => {
      const abortError = new Error("The operation was aborted")
      abortError.name = "AbortError"
      mockStreamText.mockImplementationOnce(() => {
        throw abortError
      })

      const res = await POST()
      const body = await res.json()

      expect(res.status).toBe(504)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe("AI_TIMEOUT")
      expect(body.error.message).toContain("超时")
    })

    it("AI 调用失败（普通错误）返回 502", async () => {
      mockStreamText.mockImplementationOnce(() => {
        throw new Error("Network failure")
      })

      const res = await POST()
      const body = await res.json()

      expect(res.status).toBe(502)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe("AI_GENERATION_FAILED")
      expect(body.error.message).toContain("失败")
    })
  })
})