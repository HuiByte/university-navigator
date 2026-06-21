import { generateObject } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId } from "@/lib/auth-utils"
import { env } from "@/lib/env"
import { checkRateLimit } from "@/lib/rate-limit"
import { RoadmapSchema } from "@/lib/ai-schemas"
import { errorResponse, successResponse } from "@/lib/api-response"
import { computeCurrentStageIndex } from "@/lib/roadmap-utils"

const SYSTEM_PROMPT = `你是一位严谨的项目经理，擅长将宏观规划拆解为可执行的分阶段路线图。

你的任务是根据用户的大学规划内容和个人信息，生成一份结构化的路线图。

要求：
1. stages 数组包含 3-5 个阶段，按时间顺序排列
2. 每个阶段的 actions 包含 3-5 个具体可执行的行动项
3. risks 包含 2-4 个潜在风险
4. suggestions 包含 2-4 个应对建议
5. 阶段划分要结合用户的年级和学历，合理推算时间线
6. 目标和行动要具体、可衡量、可执行`

/**
 * 查询用户任务进度并计算当前阶段索引
 * 负责数据库查询（带 userId 过滤防越权），阶段索引计算委托给纯函数 computeCurrentStageIndex
 * @param userId 用户 ID
 * @param stagesData 路线图 stages JSON 数据
 * @returns 当前阶段索引，无任务或无阶段时返回 0
 */
async function resolveCurrentStageIndex(
  userId: string,
  stagesData: unknown
): Promise<number> {
  const roadmapData = stagesData as { stages?: unknown[] }
  const stageCount = Array.isArray(roadmapData?.stages)
    ? roadmapData.stages.length
    : 0
  // 无阶段时无需查库，直接返回 0
  if (stageCount === 0) return 0

  // 查询用户任务进度（带 userId 过滤，防越权）
  const [completedCount, totalCount] = await Promise.all([
    prisma.dailyTask.count({ where: { userId, isCompleted: true } }),
    prisma.dailyTask.count({ where: { userId } }),
  ])

  // 阶段索引计算委托给纯函数（除零、边界保护在纯函数内处理）
  return computeCurrentStageIndex(stageCount, completedCount, totalCount)
}

export async function POST() {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return errorResponse("UNAUTHORIZED", "未登录，请先登录")
    }

    // 速率限制：每 userId 每分钟最多 5 次
    const { success } = checkRateLimit(userId, 5, 60_000)
    if (!success) {
      return errorResponse("RATE_LIMIT_EXCEEDED", "请求过于频繁，请稍后再试", { headers: { "Retry-After": "60" } })
    }

    // 获取用户最新的 Plan 和 UserProfile
    const latestPlan = await prisma.plan.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { profile: true },
        },
      },
    })

    if (!latestPlan) {
      return errorResponse("VALIDATION_ERROR", "请先完成规划生成")
    }

    // 检查是否已有路线图（支持重新生成）
    const existingRoadmap = await prisma.roadmap.findUnique({
      where: { planId: latestPlan.id },
    })

    // 构建用户信息上下文
    const profile = latestPlan.user.profile
    const profileInfo = profile
      ? `专业：${profile.major}，年级：${profile.grade}，学历：${profile.degree}，目标：${profile.goal}`
      : "无用户画像信息"

    const userMessage = `以下是我的个人信息和大学规划，请据此生成路线图：

**个人信息**：${profileInfo}

**规划内容**：
${latestPlan.content}

请生成包含 3-5 个阶段的路线图。`

    // 初始化 OpenAI 兼容客户端
    const openai = createOpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_BASE_URL,
    })

    // 使用 generateObject 生成结构化 JSON，AI SDK 内部自动解析并校验
    const { object: roadmapData } = await generateObject({
      model: openai(env.OPENAI_MODEL),
      schema: RoadmapSchema,
      system: SYSTEM_PROMPT,
      prompt: userMessage,
    })

    // 保存到数据库（更新或创建）
    const roadmap = existingRoadmap
      ? await prisma.roadmap.update({
          where: { planId: latestPlan.id },
          data: { stages: roadmapData },
        })
      : await prisma.roadmap.create({
          data: {
            planId: latestPlan.id,
            stages: roadmapData,
          },
        })

    const currentStageIndex = await resolveCurrentStageIndex(userId, roadmap.stages)
    return successResponse({ data: roadmap.stages, currentStageIndex })
  } catch (error) {
    console.error("生成路线图失败:", error)
    const message = error instanceof Error ? error.message : "生成路线图失败"
    // generateObject 校验失败时返回明确的格式异常提示
    if (message.includes("schema") || message.includes("JSON") || message.includes("parse")) {
      return errorResponse("AI_GENERATION_FAILED", "AI 规划格式异常，请重试")
    }
    return errorResponse("INTERNAL_ERROR", message)
  }
}

/**
 * GET 请求：获取已有的路线图数据（不触发 AI 生成）
 */
export async function GET() {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return errorResponse("UNAUTHORIZED", "未登录，请先登录")
    }

    const latestPlan = await prisma.plan.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { roadmap: true },
    })

    if (!latestPlan) {
      return successResponse({ data: null, reason: "no_plan" })
    }

    if (!latestPlan.roadmap) {
      return successResponse({ data: null, reason: "no_roadmap" })
    }

    const currentStageIndex = await resolveCurrentStageIndex(userId, latestPlan.roadmap.stages)
    return successResponse({ data: latestPlan.roadmap.stages, currentStageIndex })
  } catch (error) {
    console.error("获取路线图失败:", error)
    return errorResponse("INTERNAL_ERROR", error instanceof Error ? error.message : "获取路线图失败")
  }
}
