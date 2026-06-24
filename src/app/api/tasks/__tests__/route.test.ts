import { describe, it, expect, beforeEach, vi } from "vitest"
import { mockAuthFn, authMock } from "@/test/mocks/auth"
import { mockPrisma } from "@/test/mocks/prisma"
import { mockCheckRateLimit, rateLimitMock } from "@/test/mocks/rate-limit"
import { makeRequest } from "@/test/helpers/request"
import { GET, POST, PATCH } from "../route"

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

// 测试用假数据：符合 DailyTask 模型结构
const mockTask = {
  id: "task-001",
  userId: TEST_USER_ID,
  title: "背单词",
  description: "背诵四级词汇",
  isCompleted: false,
  priority: 3,
  estimatedMinutes: 30,
  dueDate: new Date("2026-06-22"),
}

beforeEach(() => {
  // setup.ts 的 afterEach 已统一重置，这里补充每个测试前的初始状态
  authMock.logout()
  rateLimitMock.reset()
})

// ============================================
// GET /api/tasks — 获取今日任务列表
// ============================================
describe("GET /api/tasks", () => {
  describe("鉴权", () => {
    it("未登录返回 401", async () => {
      authMock.logout()

      const res = await GET()
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe("UNAUTHORIZED")
    })

    it("已登录返回 200 及任务数组", async () => {
      authMock.loginAs(TEST_USER_ID)
      mockPrisma.dailyTask.findMany.mockResolvedValue([mockTask])

      const res = await GET()
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data).toHaveLength(1)
      expect(body.data[0].title).toBe("背单词")
    })

    it("已登录但无任务时返回空数组", async () => {
      authMock.loginAs(TEST_USER_ID)
      mockPrisma.dailyTask.findMany.mockResolvedValue([])

      const res = await GET()
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data).toEqual([])
    })

    it("Prisma 异常时返回 500", async () => {
      authMock.loginAs(TEST_USER_ID)
      mockPrisma.dailyTask.findMany.mockRejectedValue(new Error("DB connection lost"))

      const res = await GET()
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error.code).toBe("INTERNAL_ERROR")
    })
  })

  describe("查询参数", () => {
    it("findMany 查询条件包含当前 userId 和今日时间范围", async () => {
      authMock.loginAs(TEST_USER_ID)
      mockPrisma.dailyTask.findMany.mockResolvedValue([])

      await GET()

      // 验证 findMany 被调用，且 where 条件包含正确的 userId
      expect(mockPrisma.dailyTask.findMany).toHaveBeenCalledTimes(1)
      const callArg = mockPrisma.dailyTask.findMany.mock.calls[0][0]!
      expect(callArg.where!.userId).toBe(TEST_USER_ID)
      expect(callArg.where!.dueDate).toBeDefined()
      expect((callArg.where!.dueDate as { gte: Date }).gte).toBeInstanceOf(Date)
      expect((callArg.where!.dueDate as { lt: Date }).lt).toBeInstanceOf(Date)
      // 验证排序：优先级降序 + id 升序
      expect(callArg.orderBy).toEqual([{ priority: "desc" }, { id: "asc" }])
    })
  })
})

// ============================================
// POST /api/tasks — 创建任务
// ============================================
describe("POST /api/tasks", () => {
  describe("鉴权", () => {
    it("未登录返回 401", async () => {
      authMock.logout()

      const res = await POST(makeRequest("/api/tasks", { method: "POST", body: { title: "测试" } }))
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.error.code).toBe("UNAUTHORIZED")
    })
  })

  describe("限流", () => {
    it("触发限流返回 429 且包含 Retry-After 头", async () => {
      authMock.loginAs(TEST_USER_ID)
      rateLimitMock.setRateLimited()

      const res = await POST(makeRequest("/api/tasks", { method: "POST", body: { title: "测试" } }))
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

    it("缺少 title 返回 400 且包含 fieldErrors", async () => {
      const res = await POST(makeRequest("/api/tasks", { method: "POST", body: {} }))
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe("VALIDATION_ERROR")
      expect(body.error.fieldErrors).toBeDefined()
      expect(body.error.fieldErrors.title).toBeDefined()
    })

    it("title 为空字符串返回 400 且包含 fieldErrors", async () => {
      const res = await POST(makeRequest("/api/tasks", { method: "POST", body: { title: "" } }))
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe("VALIDATION_ERROR")
      expect(body.error.fieldErrors).toBeDefined()
      expect(body.error.fieldErrors.title).toBeDefined()
    })

    it("title 超过 100 字符返回 400 且包含 fieldErrors", async () => {
      const res = await POST(
        makeRequest("/api/tasks", { method: "POST", body: { title: "a".repeat(101) } })
      )
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe("VALIDATION_ERROR")
      expect(body.error.fieldErrors).toBeDefined()
      expect(body.error.fieldErrors.title).toBeDefined()
    })

    it("priority 超出范围（>5）返回 400 且包含 fieldErrors", async () => {
      const res = await POST(
        makeRequest("/api/tasks", { method: "POST", body: { title: "测试", priority: 6 } })
      )
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe("VALIDATION_ERROR")
      expect(body.error.fieldErrors).toBeDefined()
      expect(body.error.fieldErrors.priority).toBeDefined()
    })

    it("estimatedMinutes 超出范围（>480）返回 400 且包含 fieldErrors", async () => {
      const res = await POST(
        makeRequest("/api/tasks", {
          method: "POST",
          body: { title: "测试", estimatedMinutes: 500 },
        })
      )
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe("VALIDATION_ERROR")
      expect(body.error.fieldErrors).toBeDefined()
      expect(body.error.fieldErrors.estimatedMinutes).toBeDefined()
    })
  })

  describe("成功请求", () => {
    beforeEach(() => {
      authMock.loginAs(TEST_USER_ID)
      mockPrisma.dailyTask.create.mockResolvedValue(mockTask)
    })

    it("合法 body 创建任务返回 201", async () => {
      const res = await POST(
        makeRequest("/api/tasks", {
          method: "POST",
          body: { title: "背单词", description: "背诵四级词汇", priority: 3, estimatedMinutes: 30 },
        })
      )
      const body = await res.json()

      expect(res.status).toBe(201)
      expect(body.success).toBe(true)
      expect(body.data.title).toBe("背单词")
    })

    it("create 被调用时传入正确的 userId", async () => {
      await POST(
        makeRequest("/api/tasks", { method: "POST", body: { title: "背单词" } })
      )

      expect(mockPrisma.dailyTask.create).toHaveBeenCalledTimes(1)
      const createData = mockPrisma.dailyTask.create.mock.calls[0][0].data
      expect(createData.userId).toBe(TEST_USER_ID)
      expect(createData.title).toBe("背单词")
    })

    it("可选字段缺省时使用默认值", async () => {
      await POST(
        makeRequest("/api/tasks", { method: "POST", body: { title: "背单词" } })
      )

      const createData = mockPrisma.dailyTask.create.mock.calls[0][0].data
      expect(createData.description).toBe("")
      expect(createData.priority).toBe(0)
      expect(createData.estimatedMinutes).toBe(30)
    })

    it("dueDate 缺省时使用当前日期", async () => {
      await POST(
        makeRequest("/api/tasks", { method: "POST", body: { title: "背单词" } })
      )

      const createData = mockPrisma.dailyTask.create.mock.calls[0][0].data
      expect(createData.dueDate).toBeInstanceOf(Date)
      // 验证 dueDate 是今天（只比较日期部分）
      const today = new Date()
      const dueDate = createData.dueDate as Date
      expect(dueDate.getFullYear()).toBe(today.getFullYear())
      expect(dueDate.getMonth()).toBe(today.getMonth())
      expect(dueDate.getDate()).toBe(today.getDate())
    })

    it("传入 dueDate 时使用传入值", async () => {
      const customDate = "2026-07-01"
      await POST(
        makeRequest("/api/tasks", {
          method: "POST",
          body: { title: "背单词", dueDate: customDate },
        })
      )

      const createData = mockPrisma.dailyTask.create.mock.calls[0][0].data
      expect(createData.dueDate).toBeInstanceOf(Date)
      expect((createData.dueDate as Date).toISOString()).toContain("2026-07-01")
    })
  })
})

// ============================================
// PATCH /api/tasks — 更新任务完成状态
// ============================================
describe("PATCH /api/tasks", () => {
  describe("鉴权", () => {
    it("未登录返回 401", async () => {
      authMock.logout()

      const res = await PATCH(
        makeRequest("/api/tasks", { method: "PATCH", body: { taskId: "task-001", isCompleted: true } })
      )
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.error.code).toBe("UNAUTHORIZED")
    })
  })

  describe("输入校验", () => {
    beforeEach(() => {
      authMock.loginAs(TEST_USER_ID)
    })

    it("缺少 taskId 返回 400", async () => {
      const res = await PATCH(
        makeRequest("/api/tasks", { method: "PATCH", body: { isCompleted: true } })
      )
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe("VALIDATION_ERROR")
    })

    it("isCompleted 非 boolean 返回 400", async () => {
      const res = await PATCH(
        makeRequest("/api/tasks", {
          method: "PATCH",
          body: { taskId: "task-001", isCompleted: "yes" },
        })
      )
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe("VALIDATION_ERROR")
    })
  })

  describe("越权防护", () => {
    beforeEach(() => {
      authMock.loginAs(TEST_USER_ID)
    })

    it("任务不存在返回 404", async () => {
      mockPrisma.dailyTask.findFirst.mockResolvedValue(null)

      const res = await PATCH(
        makeRequest("/api/tasks", {
          method: "PATCH",
          body: { taskId: "nonexistent", isCompleted: true },
        })
      )
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error.code).toBe("NOT_FOUND")
      // 确保未执行 update
      expect(mockPrisma.dailyTask.update).not.toHaveBeenCalled()
    })

    it("操作他人任务返回 404 且不执行 update", async () => {
      // 任务归属人是 user-B，当前登录用户是 user-test-001
      mockPrisma.dailyTask.findFirst.mockResolvedValue({ ...mockTask, userId: "user-B" })

      const res = await PATCH(
        makeRequest("/api/tasks", {
          method: "PATCH",
          body: { taskId: "task-001", isCompleted: true },
        })
      )
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error.code).toBe("NOT_FOUND")
      // 关键：越权时 update 绝不能被调用
      expect(mockPrisma.dailyTask.update).not.toHaveBeenCalled()
    })
  })

  describe("成功请求", () => {
    beforeEach(() => {
      authMock.loginAs(TEST_USER_ID)
      // findFirst 返回的任务归属人是当前用户
      mockPrisma.dailyTask.findFirst.mockResolvedValue({ ...mockTask, userId: TEST_USER_ID })
      mockPrisma.dailyTask.update.mockResolvedValue({ ...mockTask, isCompleted: true })
    })

    it("合法请求更新任务返回 200", async () => {
      const res = await PATCH(
        makeRequest("/api/tasks", {
          method: "PATCH",
          body: { taskId: "task-001", isCompleted: true },
        })
      )
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.isCompleted).toBe(true)
    })

    it("update 被调用时传入正确的 taskId 和 isCompleted", async () => {
      await PATCH(
        makeRequest("/api/tasks", {
          method: "PATCH",
          body: { taskId: "task-001", isCompleted: false },
        })
      )

      expect(mockPrisma.dailyTask.update).toHaveBeenCalledTimes(1)
      const updateArgs = mockPrisma.dailyTask.update.mock.calls[0][0]
      expect(updateArgs.where.id).toBe("task-001")
      expect(updateArgs.data.isCompleted).toBe(false)
    })

    it("findFirst 查询时仅 select userId 字段（最小化查询）", async () => {
      await PATCH(
        makeRequest("/api/tasks", {
          method: "PATCH",
          body: { taskId: "task-001", isCompleted: true },
        })
      )

      const findFirstArgs = mockPrisma.dailyTask.findFirst.mock.calls[0][0]!
      expect(findFirstArgs.select).toEqual({ userId: true })
      expect(findFirstArgs.where!.id).toBe("task-001")
    })
  })
})
