import { describe, it, expect } from "vitest"
import { computeCurrentStageIndex } from "@/lib/roadmap-utils"

describe("computeCurrentStageIndex", () => {
  it("进度为 0% 时返回第一阶段（索引 0）", () => {
    expect(computeCurrentStageIndex(4, 0, 10)).toBe(0)
  })

  it("进度为 50% 时返回中间阶段", () => {
    // 3 个阶段，50% 进度：floor(0.5 * (3-1)) = floor(1) = 1，即中间索引
    expect(computeCurrentStageIndex(3, 5, 10)).toBe(1)
  })

  it("进度为 100% 时返回最后阶段", () => {
    expect(computeCurrentStageIndex(4, 10, 10)).toBe(3)
  })

  it("边界：阶段数为 0 时返回 0", () => {
    expect(computeCurrentStageIndex(0, 0, 10)).toBe(0)
  })

  it("边界：总任务数为 0 时返回 0（除零保护）", () => {
    expect(computeCurrentStageIndex(4, 0, 0)).toBe(0)
  })

  it("边界：所有任务已完成（100%）返回最后阶段", () => {
    expect(computeCurrentStageIndex(5, 10, 10)).toBe(4)
  })
})
