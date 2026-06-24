import { streamText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId } from "@/lib/auth-utils"
import { env } from "@/lib/env"
import { checkRateLimit } from "@/lib/rate-limit"
import { errorResponse } from "@/lib/api-response"

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

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // 聚合本周数据
    const weekStart = new Date(todayStart.getTime() - 6 * 86400000)

    const [checkInCount, weekTasks, totalCompleted, totalAll] = await Promise.all([
      prisma.checkInRecord.count({
        where: {
          userId,
          date: { gte: weekStart },
        },
      }),
      prisma.dailyTask.findMany({
        where: {
          userId,
          dueDate: { gte: weekStart, lt: new Date(todayStart.getTime() + 86400000) },
        },
        select: { isCompleted: true },
      }),
      prisma.dailyTask.count({
        where: { userId, isCompleted: true },
      }),
      prisma.dailyTask.count({
        where: { userId },
      }),
    ])

    const weekCompleted = weekTasks.filter((t) => t.isCompleted).length
    const weekTotal = weekTasks.length
    const weekRate = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0
    const overallRate = totalAll > 0 ? Math.round((totalCompleted / totalAll) * 100) : 0

    const systemPrompt = `你是一位温暖、有洞察力的 AI 学长，擅长根据数据给出鼓励和建设性建议。请根据以下本周学习数据，生成一段总结。

## 本周数据：
- 本周打卡天数：${checkInCount} 天
- 本周任务完成率：${weekRate}%（${weekCompleted}/${weekTotal}）
- 累计总完成率：${overallRate}%（${totalCompleted}/${totalAll}）

## 输出格式要求：
请按以下结构输出，使用 Markdown 格式：

### 🌟 本周闪光点
（根据数据，找出本周值得鼓励的地方，2-3 句话，语气温暖）

### 📈 下周改进建议
（给出 2-3 条具体的、可操作的建议，帮助下周做得更好）

### 💬 学长寄语
（一句简短有力的话，激励继续前行）

注意：
- 语气亲切，像学长和朋友一样
- 建议要具体可执行，不要空泛
- 如果数据表现好，要充分鼓励；如果数据一般，要温和地指出改进方向
- 用中文回答`

    const openai = createOpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_BASE_URL,
    })

    const result = streamText({
      model: openai.chat(env.OPENAI_MODEL),
      system: systemPrompt,
      prompt: "请根据我的本周学习数据，生成一段总结。",
      abortSignal: AbortSignal.timeout(60_000),
      onError({ error }) {
        console.error("AI 周报总结流式传输异常:", error)
      },
    })

    return result.toTextStreamResponse()
  } catch (error) {
    console.error("AI 周报总结失败:", error)

    if (error instanceof Error && error.name === "AbortError") {
      return errorResponse("AI_TIMEOUT", "AI 服务响应超时，请稍后重试")
    }

    return errorResponse("AI_GENERATION_FAILED", "AI 生成回复失败，请稍后重试")
  }
}
