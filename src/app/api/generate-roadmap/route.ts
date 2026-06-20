import { NextRequest } from "next/server"
import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId } from "@/lib/auth-utils"
import { env } from "@/lib/env"

const SYSTEM_PROMPT = `你是一位严谨的项目经理，擅长将宏观规划拆解为可执行的分阶段路线图。

你的任务是根据用户的大学规划内容和个人信息，生成一份结构化的路线图。

**你必须输出严格的 JSON 格式**，不要包含任何 markdown 标记或额外说明。

JSON 结构如下：
{
  "stages": [
    {
      "title": "阶段名称",
      "duration": "时间跨度（如：大一上学期、大一下学期等）",
      "goal": "该阶段的核心目标",
      "actions": ["具体行动1", "具体行动2", "具体行动3"]
    }
  ],
  "risks": ["潜在风险1", "潜在风险2"],
  "suggestions": ["应对建议1", "应对建议2"]
}

要求：
1. stages 数组包含 3-5 个阶段，按时间顺序排列
2. 每个阶段的 actions 包含 3-5 个具体可执行的行动项
3. risks 包含 2-4 个潜在风险
4. suggestions 包含 2-4 个应对建议
5. 阶段划分要结合用户的年级和学历，合理推算时间线
6. 目标和行动要具体、可衡量、可执行
7. 只输出 JSON，不要输出任何其他内容`

/**
 * 清洗大模型返回的 JSON 字符串
 * 处理 ```json ... ``` 包裹、前后空白、BOM 标记等情况
 */
function cleanJsonString(raw: string): string {
  let cleaned = raw.trim()

  // 移除 BOM 标记
  if (cleaned.charCodeAt(0) === 0xfeff) {
    cleaned = cleaned.slice(1)
  }

  // 处理 ```json ... ``` 包裹
  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (jsonBlockMatch) {
    cleaned = jsonBlockMatch[1].trim()
  }

  return cleaned
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return Response.json({ error: "未登录，请先登录" }, { status: 401 })
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
      return Response.json(
        { error: "请先完成规划生成" },
        { status: 400 }
      )
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

请生成包含 3-5 个阶段的路线图，输出严格的 JSON 格式。`

    // 初始化 OpenAI 兼容客户端
    const openai = createOpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_BASE_URL,
    })

    // 使用 generateText 生成结构化 JSON
    const result = await generateText({
      model: openai(env.OPENAI_MODEL),
      system: SYSTEM_PROMPT,
      prompt: userMessage,
    })

    // 清洗并解析 JSON
    const cleanedJson = cleanJsonString(result.text)
    let roadmapData: unknown

    try {
      roadmapData = JSON.parse(cleanedJson)
    } catch (parseError) {
      console.error("JSON 解析失败，原始内容:", result.text)
      console.error("清洗后内容:", cleanedJson)
      return Response.json(
        { error: "AI 返回的数据格式异常，请重试" },
        { status: 500 }
      )
    }

    // 校验 JSON 结构
    const data = roadmapData as Record<string, unknown>
    if (!Array.isArray(data.stages) || data.stages.length === 0) {
      return Response.json(
        { error: "AI 返回的路线图结构不完整，请重试" },
        { status: 500 }
      )
    }

    // 保存到数据库（更新或创建）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stagesInput = roadmapData as any
    const roadmap = existingRoadmap
      ? await prisma.roadmap.update({
          where: { planId: latestPlan.id },
          data: { stages: stagesInput },
        })
      : await prisma.roadmap.create({
          data: {
            planId: latestPlan.id,
            stages: stagesInput,
          },
        })

    return Response.json({ data: roadmap.stages })
  } catch (error) {
    console.error("生成路线图失败:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "生成路线图失败" },
      { status: 500 }
    )
  }
}

/**
 * GET 请求：获取已有的路线图数据（不触发 AI 生成）
 */
export async function GET() {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return Response.json({ error: "未登录，请先登录" }, { status: 401 })
    }

    const latestPlan = await prisma.plan.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { roadmap: true },
    })

    if (!latestPlan) {
      return Response.json({ data: null, reason: "no_plan" })
    }

    if (!latestPlan.roadmap) {
      return Response.json({ data: null, reason: "no_roadmap" })
    }

    return Response.json({ data: latestPlan.roadmap.stages })
  } catch (error) {
    console.error("获取路线图失败:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "获取路线图失败" },
      { status: 500 }
    )
  }
}
