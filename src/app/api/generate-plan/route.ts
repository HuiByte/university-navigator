import { NextRequest } from "next/server"
import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId } from "@/lib/auth-utils"
import { env } from "@/lib/env"
import { checkRateLimit } from "@/lib/rate-limit"
import { errorResponse, successResponse } from "@/lib/api-response"
import { generatePlanSchema } from "@/lib/ai-schemas"

const SYSTEM_PROMPT = `你是一位资深且温暖的大学职业规划师，拥有丰富的教育咨询和职业指导经验。你的任务是根据学生提供的个人信息，为其量身定制一份详细、可执行的大学规划方案。

请按以下结构输出规划方案：

## 📋 个人画像分析
简要分析学生的专业背景、当前阶段和核心目标。

## 🎯 短期目标（1-6个月）
列出3-5个具体的短期目标，每个目标要SMART化（具体、可衡量、可达成、相关、有时限）。

## 🏔️ 中期目标（6个月-1年）
列出3-5个中期目标，关注能力提升和资源积累。

## 🚀 长期目标（1年以上）
列出2-3个长期目标，与最终职业方向对齐。

## 📅 行动计划
按时间线给出具体的行动建议，包括：
- 学习计划（课程、书籍、在线资源）
- 实践项目建议
- 证书/考试时间节点
- 实习/求职时间规划

## 💡 优势发挥策略
针对学生的优点，给出如何最大化利用优势的建议。

## ⚠️ 劣势改善建议
针对学生的缺点，给出具体的改善方法和替代策略。

## 📚 推荐资源
推荐相关的书籍、网站、工具和社区。

注意事项：
- 语气温暖鼓励，但建议要务实
- 目标要切合实际，循序渐进
- 充分考虑学生的专业特点和当前阶段
- 如果信息不足，给出合理假设并标注
- 用中文回答`

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return errorResponse("UNAUTHORIZED", "未登录，请先登录")
    }

    // 速率限制：每 userId 每分钟最多 5 次
    const { success } = await checkRateLimit(userId, 5, 60_000)
    if (!success) {
      return errorResponse("RATE_LIMIT_EXCEEDED", "请求过于频繁，请稍后再试", { headers: { "Retry-After": "60" } })
    }

    const body = await request.json()
    const parsed = generatePlanSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "输入校验失败",
        undefined,
        parsed.error.flatten().fieldErrors
      )
    }

    const { major, grade, degree, goal, strengths, weaknesses, extraInfo } = parsed.data

    // 收集非阻断性警告，随成功响应返回给前端
    const warnings: string[] = []

    // 持久化用户画像（upsert：首次创建，后续更新）
    // 容错处理：保存失败不阻断后续 AI 规划生成流程，仅记录警告
    try {
      await prisma.userProfile.upsert({
        where: { userId },
        create: { userId, major, grade, degree, goal, strengths, weaknesses },
        update: { major, grade, degree, goal, strengths, weaknesses },
      })
    } catch (dbError) {
      console.warn("保存用户画像到数据库失败:", dbError)
      warnings.push("用户画像保存失败，可能影响后续推荐")
    }

    // 初始化 OpenAI 兼容客户端（支持国内大模型）
    const openai = createOpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_BASE_URL,
    })

    // 构建用户消息
    const userMessage = `请根据以下信息为我制定大学规划：

**专业**：${major}
**年级**：${grade}
**学历**：${degree}
**目标**：${goal}
**优点**：${strengths}
**缺点**：${weaknesses}
${extraInfo ? `**补充信息**：${extraInfo}` : ""}

请给出详细、可执行的规划方案。`

    const result = await generateText({
      model: openai(env.OPENAI_MODEL),
      system: SYSTEM_PROMPT,
      prompt: userMessage,
    })

    // 生成完成后，将完整规划内容保存到数据库
    try {
      await prisma.plan.create({
        data: {
          userId,
          content: result.text,
        },
      })
    } catch (dbError) {
      console.error("保存规划到数据库失败:", dbError)
    }

    return successResponse({ plan: result.text, warnings })
  } catch (error) {
    console.error("生成规划失败:", error)
    return errorResponse(
      "AI_GENERATION_FAILED",
      error instanceof Error ? error.message : "生成规划失败"
    )
  }
}
