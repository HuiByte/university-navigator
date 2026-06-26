import { NextRequest } from "next/server"
import { z } from "zod"
import { streamText, convertToModelMessages } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId } from "@/lib/auth-utils"
import { env } from "@/lib/env"
import { checkRateLimit } from "@/lib/rate-limit"
import { errorResponse } from "@/lib/api-response"
import { getDayRange } from "@/lib/date-utils"

// Chat 请求校验 Schema
// 兼容 Vercel AI SDK 的 UIMessage（role + parts）与 CoreMessage（role + content）两种结构
// 替换不安全的 `body as {...}` 运行时断言
const chatMessagePartSchema = z.object({
  type: z.string().min(1),
}).passthrough() // 允许 text/state/toolInvocation 等扩展字段透传给 SDK

const chatMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(["system", "user", "assistant"]),
  parts: z.array(chatMessagePartSchema).min(1).optional(),
  content: z.string().optional(),
}).passthrough().superRefine((data, ctx) => {
  // 至少包含 parts（UIMessage）或 content（CoreMessage）之一
  if (data.parts === undefined && data.content === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["parts"],
      message: "消息必须包含 parts 或 content 字段",
    })
  }
})

const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1, "messages 不能为空"),
  energy: z.string().optional(),
  taskId: z.string().optional(),
})

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
    const parsed = chatRequestSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "messages 校验失败",
        undefined,
        parsed.error.flatten().fieldErrors
      )
    }

    const { messages, energy, taskId } = parsed.data

    // 将 UIMessage 格式转换为 ModelMessage 格式（id 字段由 SDK 内部处理）
    // 类型断言：zod safeParse 已校验 messages 结构（至少含 parts 或 content），此处仅做 TS 类型兼容
    const modelMessages = await convertToModelMessages(
      messages as Parameters<typeof convertToModelMessages>[0]
    )

    // 查询当前用户的今日任务列表，作为上下文注入
    // 今日 [start, end) 半开区间（按默认时区 Asia/Shanghai 计算当日边界）
    const { start: startOfDay, end: endOfDay } = getDayRange()

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

    // 若前端传入了 taskId，查询该具体任务（必须校验 userId 防水平越权）
    // 查不到（taskId 伪造或属于他人）则降级为无特定任务上下文，不报错、不泄露他人数据
    let focusTask: { title: string; description: string; estimatedMinutes: number } | null = null
    if (taskId) {
      const task = await prisma.dailyTask.findFirst({
        where: { id: taskId, userId },
        select: { title: true, description: true, estimatedMinutes: true },
      })
      if (task) {
        focusTask = task
      }
    }

    // 用户当前卡壳的具体任务（高亮区块，优先级最高，置于全局任务列表之前）
    const focusBlock = focusTask
      ? `## 🎯 用户当前正在执行且遇到困难的任务：
- 任务名称：${focusTask.title}
- 任务详情：${focusTask.description || "（无详细描述）"}
- 预估时长：${focusTask.estimatedMinutes} 分钟
请针对这个具体任务提供详细的拆解步骤、学习建议或心理疏导。`
      : ""

    // 构建 System Prompt
    const systemPrompt = `你是一个温暖、专业、有经验的 AI 学长。你正在指导大学生完成今天的任务。请根据他当前的任务列表和精力状态，提供紧扣实际的解答和鼓励。不要给出脱离他当前任务的空泛建议。
${focusBlock ? `\n${focusBlock}\n` : ""}
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
