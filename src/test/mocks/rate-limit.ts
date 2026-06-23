import { vi } from "vitest"

// 默认永远放行，避免测试间 globalThis 状态污染
// 变量名以 mock 开头，满足 vi.mock hoisting 例外规则
export const mockCheckRateLimit = vi.fn(() => ({
  success: true,
  remaining: 999,
}))

/** RateLimit mock 控制器 */
export const rateLimitMock = {
  /** 模拟触发限流 */
  setRateLimited() {
    mockCheckRateLimit.mockReturnValue({ success: false, remaining: 0 })
  },
  /** 重置为默认放行状态 */
  reset() {
    mockCheckRateLimit.mockReset()
    mockCheckRateLimit.mockReturnValue({ success: true, remaining: 999 })
  },
}
