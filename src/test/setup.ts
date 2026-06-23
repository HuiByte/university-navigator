import { vi, afterEach } from "vitest"
import { mockReset } from "vitest-mock-extended"
import { mockPrisma } from "@/test/mocks/prisma"
import { authMock } from "@/test/mocks/auth"
import { rateLimitMock } from "@/test/mocks/rate-limit"

// 抑制路由中的 console.error / console.info 输出，保持测试输出整洁
vi.spyOn(console, "error").mockImplementation(() => {})
vi.spyOn(console, "info").mockImplementation(() => {})

// 每个测试后重置所有 mock 状态，防止测试间状态泄漏
afterEach(() => {
  authMock.reset()
  rateLimitMock.reset()
  mockReset(mockPrisma)
})
