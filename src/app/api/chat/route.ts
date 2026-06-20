/*
 * @Author: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @Date: 2026-06-17 23:45:13
 * @LastEditors: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @LastEditTime: 2026-06-19 10:15:31
 * @FilePath: \AI创作力大赛\university-navigator\src\app\api\chat\route.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { NextRequest } from "next/server"
import { streamText, convertToModelMessages } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId } from "@/lib/auth-utils"

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return Response.json({ error: "未登录，请先登录" }, { status: 401 })
    }

    const body = await request.json()
    const { messages, energy } = body as {
      messages: Record<string, unknown>[]
      energy?: string
    }

    if (!messages || !Array.isArray(messages)) {
      return Response.json(
        { error: "缺少 messages 字段" },
        { status: 400 }
      )
    }

    // 将 UIMessage 格式转换为 ModelMessage 格式
    const modelMessages = await convertToModelMessages(
      messages.map(({ id, ...rest }) => rest) as Parameters<typeof convertToModelMessages>[0]
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
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    })

    const result = streamText({
      model: openai(process.env.OPENAI_MODEL || "deepseek-chat"),
      system: systemPrompt,
      messages: modelMessages,
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error("AI 对话失败:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "AI 对话失败" },
      { status: 500 }
    )
  }
}
