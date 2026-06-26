import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId } from "@/lib/auth-utils"
import { env } from "@/lib/env"
import { checkRateLimit } from "@/lib/rate-limit"
import { RoadmapSchema, type RoadmapData } from "@/lib/ai-schemas"
import { errorResponse, successResponse } from "@/lib/api-response"
import { computeCurrentStageIndex } from "@/lib/roadmap-utils"
import { parseAIJsonResponse } from "@/lib/ai-response-parser"
import { sanitizeUserInput, ANTI_INJECTION_DIRECTIVE } from "@/lib/ai-utils"

const SYSTEM_PROMPT = `你是一位严谨的项目经理，擅长将宏观规划拆解为可执行的分阶段路线图。

你的任务是根据用户的大学规划内容和个人信息，生成一份结构化的路线图。

要求：
1. stages 数组包含 3-5 个阶段，按时间顺序排列
2. 每个阶段的 actions 包含 3-5 个具体可执行的行动项
3. risks 包含 2-4 个潜在风险
4. suggestions 包含 2-4 个应对建议
5. 阶段划分要结合用户的年级和学历，合理推算时间线
6. 目标和行动要具体、可衡量、可执行

**JSON 格式要求（极其重要，务必严格遵守）**：
- 必须且只能输出合法的纯 JSON 字符串，绝对不要包含 markdown 代码块（如 \`\`\`json），也不要包含任何解释性文字。
- "actions" MUST be a strict JSON array of strings (e.g., ["task1", "task2"]). NEVER use a single multiline string for actions. 绝对不要把 actions 写成带换行符或数字序号的长字符串（如 "1. 任务A\\n2. 任务B" 是错误的），必须是 ["任务A", "任务B"] 这样的字符串数组。
- "risks" 和 "suggestions" 同样必须是字符串数组，不可写成单个字符串。

正确的 JSON 结构示例：
{
  "stages": [
    {
      "title": "阶段名称",
      "duration": "大一上学期",
      "goal": "该阶段的核心目标",
      "actions": ["行动项1", "行动项2", "行动项3"]
    }
  ],
  "risks": ["风险1", "风险2"],
  "suggestions": ["建议1", "建议2"]
}${ANTI_INJECTION_DIRECTIVE}`

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
    const { success } = await checkRateLimit(userId, 5, 60_000)
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

    // 检查是否已有 ACTIVE 路线图（Plan → Roadmap 为 1:N，需用 findFirst）
    const existingRoadmap = await prisma.roadmap.findFirst({
      where: { planId: latestPlan.id, status: "ACTIVE" },
    })

    // 构建用户信息上下文（对用户画像字段清洗，防止 Prompt 注入）
    const profile = latestPlan.user.profile
    const profileInfo = profile
      ? `专业：${sanitizeUserInput(profile.major)}，年级：${sanitizeUserInput(profile.grade)}，学历：${sanitizeUserInput(profile.degree)}，目标：${sanitizeUserInput(profile.goal)}`
      : "无用户画像信息"

    const userMessage = `以下是我的个人信息和大学规划，请据此生成路线图：

**个人信息**：${profileInfo}

**规划内容**：
${latestPlan.content}

请生成包含 3-5 个阶段的路线图。`

    // 初始化 OpenAI 兼容客户端
    // 使用 openai.chat(model) 走 Chat Completions API，DeepSeek 不支持 Responses API
    const openai = createOpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_BASE_URL,
    })

    // 使用 generateText 生成 JSON 文本，再手动解析校验
    // 不使用 generateObject：它默认发送 response_format: { type: 'json_schema' }，
    // DeepSeek 不支持 json_schema 模式，只支持 json_object，会返回 400
    // JSON 结构示例已内置于 SYSTEM_PROMPT，无需再拼接 JSON.stringify(RoadmapSchema.shape)
    const result = await generateText({
      model: openai.chat(env.OPENAI_MODEL),
      system: SYSTEM_PROMPT,
      prompt: userMessage,
      abortSignal: AbortSignal.timeout(60_000),
    })

    // 使用 parseAIJsonResponse 提取 JSON（三策略递进 + 兜底）
    let roadmapData: RoadmapData
    try {
      const parsed = parseAIJsonResponse(result.text)
      roadmapData = RoadmapSchema.parse(parsed)
    } catch (parseError) {
      console.error("路线图 JSON 解析/校验失败:", parseError)
      const message = parseError instanceof Error ? parseError.message : ""
      if (message === "JSON_PARSE_FAILED") {
        return errorResponse("AI_GENERATION_FAILED", "AI 返回格式异常，无法解析")
      }
      return errorResponse("AI_GENERATION_FAILED", "AI 规划格式异常，请重试")
    }

    // 计算新版本号
    const newVersion = existingRoadmap ? existingRoadmap.version + 1 : 1

    // 基于用户真实任务进度计算当前阶段索引（查库统计完成数 + 纯函数映射）
    // 必须在事务外调用：resolveCurrentStageIndex 使用 prisma（非 tx）查询
    const currentStageIndex = await resolveCurrentStageIndex(userId, roadmapData)

    // 提取当前阶段的 actions 用于生成 DailyTask
    const currentStage = roadmapData.stages[currentStageIndex]
    const today = new Date()

    // 事务：归档旧路线图 + 清理旧未完成任务 + 创建新路线图 + 生成新任务
    const roadmap = await prisma.$transaction(async (tx) => {
      // Step A: 归档旧 Roadmap & 清理关联的未完成任务
      if (existingRoadmap) {
        // 归档旧路线图
        await tx.roadmap.update({
          where: { id: existingRoadmap.id },
          data: { status: "ARCHIVED", archivedAt: new Date() },
        })

        // 删除旧路线图关联的未完成任务（已完成的保留作为历史记录）
        await tx.dailyTask.deleteMany({
          where: {
            roadmapId: existingRoadmap.id,
            isCompleted: false,
          },
        })
      }

      // Step B: 创建新 Roadmap
      const newRoadmap = await tx.roadmap.create({
        data: {
          planId: latestPlan.id,
          stages: roadmapData,
          version: newVersion,
          status: "ACTIVE",
        },
      })

      // Step C: 根据当前阶段的 actions 批量生成 DailyTask
      if (currentStage && currentStage.actions.length > 0) {
        await tx.dailyTask.createMany({
          data: currentStage.actions.map((action, index) => ({
            userId,
            title: action,
            description: currentStage.goal,
            isCompleted: false,
            priority: currentStage.actions.length - index, // 按顺序递减，第一个优先级最高
            estimatedMinutes: 60,
            dueDate: today,
            roadmapId: newRoadmap.id,
            stageIndex: currentStageIndex,
          })),
        })

        console.info(
          `用户 ${userId} 路线图生成完成，自动创建 ${currentStage.actions.length} 条每日任务`
        )
      }

      return newRoadmap
    })

    return successResponse({ data: roadmap.stages, currentStageIndex })
  } catch (error) {
    console.error("生成路线图失败:", error)

    if (error instanceof Error && error.name === "AbortError") {
      return errorResponse("AI_TIMEOUT", "AI 服务响应超时，请稍后重试")
    }

    const message = error instanceof Error ? error.message : "生成路线图失败"
    // generateObject 校验失败时返回明确的格式异常提示
    if (message.includes("schema") || message.includes("JSON") || message.includes("parse")) {
      return errorResponse("AI_GENERATION_FAILED", "AI 规划格式异常，请重试")
    }
    return errorResponse("INTERNAL_ERROR", "服务器内部错误，请稍后重试")
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
      include: { roadmaps: { where: { status: "ACTIVE" } } },
    })

    if (!latestPlan) {
      return successResponse({ data: null, reason: "no_plan" })
    }

    const activeRoadmap = latestPlan.roadmaps[0]

    if (!activeRoadmap) {
      return successResponse({ data: null, reason: "no_roadmap" })
    }

    const currentStageIndex = await resolveCurrentStageIndex(userId, activeRoadmap.stages)
    return successResponse({ data: activeRoadmap.stages, currentStageIndex })
  } catch (error) {
    console.error("获取路线图失败:", error)
    return errorResponse("INTERNAL_ERROR", error instanceof Error ? error.message : "获取路线图失败")
  }
}
