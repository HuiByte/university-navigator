import { z } from "zod"

/**
 * AI 路线图输出的 Zod Schema
 * 用于 generateObject 结构化校验，确保 AI 返回的 JSON 符合前端契约
 */
export const RoadmapSchema = z.object({
  stages: z
    .array(
      z.object({
        title: z.string().describe("阶段名称"),
        duration: z.string().describe("时间跨度，如：大一上学期"),
        goal: z.string().describe("该阶段的核心目标"),
        actions: z.array(z.string()).describe("具体可执行的行动项"),
      })
    )
    .describe("路线图阶段数组，3-5 个阶段，按时间顺序排列"),
  risks: z.array(z.string()).describe("潜在风险"),
  suggestions: z.array(z.string()).describe("应对建议"),
})

export type RoadmapData = z.infer<typeof RoadmapSchema>
