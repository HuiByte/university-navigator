import { NextRequest } from "next/server"
import { streamText, convertToModelMessages } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId } from "@/lib/auth-utils"
import { env } from "@/lib/env"
import { checkRateLimit } from "@/lib/rate-limit"
import { errorResponse } from "@/lib/api-response"

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
    const { messages, energy } = body as {
      messages: Record<string, unknown>[]
      energy?: string
    }

    if (!messages || !Array.isArray(messages)) {
      return errorResponse("VALIDATION_ERROR", "缺少 messages 字段")
    }

    // 将 UIMessage 格式转换为 ModelMessage 格式（id 字段由 SDK 内部处理）
    const modelMessages = await convertToModelMessages(
      messages as Parameters<typeof convertToModelMessages>[0]
    )

    // 查询当前用户的今日任务列表，作为上下文注入
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

    const tasks = await prisma.dailyTask.findMany({
      where: {
        userId,
        dueDate: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
      orderBy: [{ priority: "desc" }, { id: "asc" }],
    })

    // 构建任务上下文
    const taskListStr = tasks.length > 0
      ? tasks
          .map((t, i) => `${i + 1}. [${t.isCompleted ? "已完成" : "未完成"}] ${t.title}（预估${t.estimatedMinutes}分钟，优先级${t.priority}）`)
          .join("\n")
      : "今日暂无任务"

    const energyMap: Record<string, string> = {
      full: "精力充沛 🔋",
      normal: "状态一般 😐",
      low: "有点疲惫 🪫",
    }
    const energyLabel = energyMap[energy || "normal"] || "状态一般 😐"

    // 构建 System Prompt
    const systemPrompt = `你是一个温暖、专业、有经验的 AI 学长。你正在指导大学生完成今天的任务。请根据他当前的任务列表和精力状态，提供紧扣实际的解答和鼓励。不要给出脱离他当前任务的空泛建议。

## 当前用户的今日任务列表：
${taskListStr}

## 当前用户的精力状态：
${energyLabel}

## 指导原则：
1. 如果用户精力充沛，鼓励他挑战高优先级任务
2. 如果用户状态一般，建议先完成中等优先级任务热身
3. 如果用户有点疲惫，建议先做简单短时任务，或者适当休息，不要勉强
4. 当用户在某个任务上"卡壳"时，给出具体的、可操作的提示，而不是泛泛而谈
5. 语气要像学长一样亲切，可以适当用emoji，但不要过度
6. 回答要简洁实用，不要长篇大论`

    const openai = createOpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_BASE_URL,
    })

    const result = streamText({
      model: openai.chat(env.OPENAI_MODEL),
      system: systemPrompt,
      messages: modelMessages,
      abortSignal: AbortSignal.timeout(120_000),
      onError({ error }) {
        console.error("AI 对话流式传输异常:", error)
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error("AI 对话失败:", error)

    if (error instanceof Error && error.name === "AbortError") {
      return errorResponse("AI_TIMEOUT", "AI 服务响应超时，请稍后重试")
    }

    return errorResponse("AI_GENERATION_FAILED", "AI 生成回复失败，请稍后重试")
  }
}
