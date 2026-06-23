import { vi } from "vitest"

// 模块级 session 状态，测试中通过 authMock 动态切换
// 变量名以 mock 开头，满足 vi.mock hoisting 例外规则
let mockSession: { user: { id: string } } | null = null

// auth() 的 mock 实现，每次调用时读取当前 mockSession
export const mockAuthFn = vi.fn(async () => mockSession)

/** Auth mock 控制器：切换登录状态 */
export const authMock = {
  /** 模拟已登录用户 */
  loginAs(userId: string) {
    mockSession = { user: { id: userId } }
  },
  /** 模拟未登录 */
  logout() {
    mockSession = null
  },
  /** 重置到初始状态（未登录 + 清除调用记录） */
  reset() {
    mockSession = null
    mockAuthFn.mockClear()
  },
}
