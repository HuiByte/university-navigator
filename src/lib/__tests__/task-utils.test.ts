import { describe, it, expect } from "vitest"
import { verifyTaskOwnership } from "@/lib/task-utils"

describe("verifyTaskOwnership", () => {
  it("用户 ID 匹配，返回 true", () => {
    expect(verifyTaskOwnership("user-123", "user-123")).toBe(true)
  })

  it("用户 ID 不匹配，返回 false", () => {
    expect(verifyTaskOwnership("user-123", "user-456")).toBe(false)
  })

  it("任务不存在（taskUserId 为 null），返回 false", () => {
    expect(verifyTaskOwnership(null, "user-123")).toBe(false)
  })
})
