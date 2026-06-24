import { z } from "zod"

/**
 * 防御性字符串数组清洗
 * 容错处理 AI 输出不稳定问题（DeepSeek 偶尔把数组输出成带换行/序号的长字符串）：
 * - string[]：逐项 trim 并过滤空串
 * - string：按换行符拆分，去除数字序号前缀（如 "1. " / "2) "），trim 后过滤空串
 * - 其他类型：原样透传，交由后续 z.array(z.string()) 抛出明确校验错误
 */
function coerceToStringArray(val: unknown): unknown {
  if (Array.isArray(val)) {
    return val
      .map((item) => (typeof item === "string" ? item.trim() : String(item).trim()))
      .filter((item) => item.length > 0)
  }
  if (typeof val === "string") {
    return val
      .split(/\r?\n/)
      .map((line) =>
        line
          // 去除数字序号前缀（如 "1. " / "2) "）和项目符号前缀（如 "- " / "* " / "• "）
          .replace(/^(?:\d+[\.\)]\s*|[-*•]\s+)/, "")
          .trim()
      )
      .filter((line) => line.length > 0)
  }
  return val
}

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
        actions: z
          .preprocess(coerceToStringArray, z.array(z.string()))
          .describe("具体可执行的行动项"),
      })
    )
    .describe("路线图阶段数组，3-5 个阶段，按时间顺序排列"),
  risks: z.array(z.string()).describe("潜在风险"),
  suggestions: z.array(z.string()).describe("应对建议"),
})

export type RoadmapData = z.infer<typeof RoadmapSchema>

/**
 * 生成大学规划请求的 Zod Schema
 * 校验前端提交的用户画像字段，确保必填项齐全且非空
 * extraInfo 为可选补充信息
 */
export const generatePlanSchema = z.object({
  major: z.string().min(1, "专业不能为空"),
  grade: z.string().min(1, "年级不能为空"),
  degree: z.string().min(1, "学历不能为空"),
  goal: z.string().min(1, "目标不能为空"),
  strengths: z.string().min(1, "优势不能为空"),
  weaknesses: z.string().min(1, "劣势不能为空"),
  extraInfo: z.string().optional(),
})

export type GeneratePlanInput = z.infer<typeof generatePlanSchema>
