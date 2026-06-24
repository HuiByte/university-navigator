import { describe, it, expect, beforeEach, vi } from "vitest"
import { mockAuthFn, authMock } from "@/test/mocks/auth"
import { mockPrisma } from "@/test/mocks/prisma"
import { mockCheckRateLimit, rateLimitMock } from "@/test/mocks/rate-limit"
import { mockStreamText, mockConvertToModelMessages, aiMock } from "@/test/mocks/ai"
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
    DATABASE_URL: "test-db-url",
    OPENAI_API_KEY: "test-key",
    OPENAI_BASE_URL: "https://api.openai.com/v1",
    OPENAI_MODEL: "gpt-4-test",
    AUTH_GITHUB_ID: "test-github-id",
    AUTH_GITHUB_SECRET: "test-github-secret",
    AUTH_SECRET: "test-secret",
  },
}))
vi.mock("ai", () => ({
  streamText: mockStreamText,
  convertToModelMessages: mockConvertToModelMessages,
}))

const TEST_USER_ID = "user-test-001"

beforeEach(() => {
  authMock.logout()
  rateLimitMock.reset()
  aiMock.reset()
})

// ============================================
// POST /api/chat — AI 学长对话
// ============================================
describe("POST /api/chat", () => {
  describe("鉴权", () => {
    it("未登录返回 401", async () => {
      authMock.logout()

      const res = await POST(
        makeRequest("/api/chat", {
          method: "POST",
          body: { messages: [{ role: "user", content: "你好" }] },
        }),
      )
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

      const res = await POST(
        makeRequest("/api/chat", {
          method: "POST",
          body: { messages: [{ role: "user", content: "你好" }] },
        }),
      )
      const body = await res.json()

      expect(res.status).toBe(429)
      expect(body.error.code).toBe("RATE_LIMIT_EXCEEDED")
      expect(res.headers.get("Retry-After")).toBe("60")
    })
  })

  describe("输入校验", () => {
    beforeEach(() => {
      authMock.loginAs(TEST_USER_ID)
    })

    it("缺少 messages 字段返回 400", async () => {
      const res = await POST(
        makeRequest("/api/chat", { method: "POST", body: {} }),
      )
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe("VALIDATION_ERROR")
      expect(body.error.message).toContain("messages")
    })

    it("messages 不是数组时返回 400", async () => {
      const res = await POST(
        makeRequest("/api/chat", {
          method: "POST",
          body: { messages: "not-an-array" },
        }),
      )
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe("VALIDATION_ERROR")
    })
  })

  describe("成功返回流式响应", () => {
    beforeEach(() => {
      authMock.loginAs(TEST_USER_ID)

      // Mock 今日任务列表
      mockPrisma.dailyTask.findMany.mockResolvedValue([
        {
          id: "task-001",
          userId: TEST_USER_ID,
          title: "背单词",
          isCompleted: false,
          priority: 3,
          estimatedMinutes: 30,
          dueDate: new Date(),
          description: "",
          roadmapId: null,
          stageIndex: null,
        },
      ])
    })

    it("返回 200 且 Content-Type 包含 event-stream", async () => {
      const res = await POST(
        makeRequest("/api/chat", {
          method: "POST",
          body: { messages: [{ role: "user", content: "你好" }] },
        }),
      )

      expect(res.status).toBe(200)
      expect(res.headers.get("Content-Type")).toContain("event-stream")
    })

    it("streamText 被调用且传入了正确的 messages 和 system prompt", async () => {
      const userMessages = [{ role: "user", content: "今天有什么任务？" }]

      await POST(
        makeRequest("/api/chat", {
          method: "POST",
          body: { messages: userMessages },
        }),
      )

      expect(mockStreamText).toHaveBeenCalledTimes(1)
      const calls = (mockStreamText as any).mock.calls
      const callArg = calls[0][0] as any

      // system prompt 应包含任务上下文
      expect(callArg.system).toContain("AI 学长")
      expect(callArg.system).toContain("背单词")

      // messages 应通过 convertToModelMessages 转换后传入
      expect(callArg.messages).toBeDefined()
      expect(Array.isArray(callArg.messages)).toBe(true)

      // convertToModelMessages 应被调用
      expect(mockConvertToModelMessages).toHaveBeenCalledTimes(1)

      // abortSignal 应存在（120 秒超时保护）
      expect(callArg.abortSignal).toBeDefined()
    })

    it("可传入 energy 字段并影响 system prompt", async () => {
      await POST(
        makeRequest("/api/chat", {
          method: "POST",
          body: {
            messages: [{ role: "user", content: "你好" }],
            energy: "low",
          },
        }),
      )

      const calls = (mockStreamText as any).mock.calls
      const callArg = calls[0][0] as any
      // 精力值应体现在 system prompt 中
      expect(callArg.system).toContain("疲惫")
    })
  })

  describe("单任务上下文注入（taskId）", () => {
    beforeEach(() => {
      authMock.loginAs(TEST_USER_ID)
      // vitest 未开启 clearMocks，手动清理 findFirst 调用记录，保证 not.toHaveBeenCalled 断言准确
      mockPrisma.dailyTask.findFirst.mockClear()

      // Mock 今日任务列表（全局背景上下文）
      mockPrisma.dailyTask.findMany.mockResolvedValue([
        {
          id: "task-001",
          userId: TEST_USER_ID,
          title: "背单词",
          isCompleted: false,
          priority: 3,
          estimatedMinutes: 30,
          dueDate: new Date(),
          description: "",
          roadmapId: null,
          stageIndex: null,
        },
      ])
    })

    it("传入 taskId 且任务属于当前用户时，system prompt 注入该任务的标题与描述", async () => {
      // 模拟查到属于当前用户的具体卡壳任务
      // 路由侧用 select 只取 title/description/estimatedMinutes，mock 值用 as any 对齐
      mockPrisma.dailyTask.findFirst.mockResolvedValue({
        title: "完成高数第三章习题",
        description: "重点练习极限与连续部分",
        estimatedMinutes: 60,
      } as any)

      await POST(
        makeRequest("/api/chat", {
          method: "POST",
          body: {
            messages: [{ role: "user", content: "这个任务怎么拆解？" }],
            taskId: "task-002",
          },
        }),
      )

      // 必须带 userId 做防越权校验
      expect(mockPrisma.dailyTask.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "task-002", userId: TEST_USER_ID }),
        }),
      )

      const calls = (mockStreamText as any).mock.calls
      const callArg = calls[0][0] as any
      expect(callArg.system).toContain("用户当前正在执行且遇到困难的任务")
      expect(callArg.system).toContain("完成高数第三章习题")
      expect(callArg.system).toContain("重点练习极限与连续部分")
      expect(callArg.system).toContain("60 分钟")
    })

    it("taskId 属于他人/伪造（查不到）时降级：不注入该任务上下文、不报错、返回 200", async () => {
      // 模拟越权：findFirst 查不到（taskId 不属于当前用户）
      mockPrisma.dailyTask.findFirst.mockResolvedValue(null)

      const res = await POST(
        makeRequest("/api/chat", {
          method: "POST",
          body: {
            messages: [{ role: "user", content: "你好" }],
            taskId: "someone-else-task",
          },
        }),
      )

      // 不报错，正常返回流式响应
      expect(res.status).toBe(200)
      expect(res.headers.get("Content-Type")).toContain("event-stream")

      const calls = (mockStreamText as any).mock.calls
      const callArg = calls[0][0] as any
      // 不应包含卡壳任务高亮区块（不泄露他人任务信息）
      expect(callArg.system).not.toContain("用户当前正在执行且遇到困难的任务")
      // 仍应保留全局任务列表背景
      expect(callArg.system).toContain("背单词")
    })

    it("不传 taskId 时走原有逻辑，不查询 findFirst", async () => {
      await POST(
        makeRequest("/api/chat", {
          method: "POST",
          body: { messages: [{ role: "user", content: "你好" }] },
        }),
      )

      expect(mockPrisma.dailyTask.findFirst).not.toHaveBeenCalled()
    })
  })
})