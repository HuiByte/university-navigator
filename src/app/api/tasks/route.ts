import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId } from "@/lib/auth-utils"
import { errorResponse, successResponse } from "@/lib/api-response"
import { verifyTaskOwnership } from "@/lib/task-utils"
import { checkRateLimit } from "@/lib/rate-limit"
import { z } from "zod"

// 创建任务校验：title 必填，dueDate 缺省为今天，priority/estimatedMinutes 可选
const createTaskSchema = z.object({
  title: z.string().min(1, "任务标题不能为空").max(100),
  description: z.string().optional(),
  priority: z.number().int().min(0).max(5).optional(),
  estimatedMinutes: z.number().int().min(1).max(480).optional(),
  dueDate: z.coerce.date().optional(),
})

// GET: 获取今日任务列表，按优先级降序 + 创建时间升序排列
export async function GET() {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return errorResponse("UNAUTHORIZED", "未登录，请先登录")
    }

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

    return successResponse(tasks)
  } catch (error) {
    console.error("获取任务列表失败:", error)
    return errorResponse("INTERNAL_ERROR", "获取任务列表失败")
  }
}

// PATCH: 更新任务完成状态
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return errorResponse("UNAUTHORIZED", "未登录，请先登录")
    }

    const body = await request.json()
    const { taskId, isCompleted } = body

    if (!taskId || typeof isCompleted !== "boolean") {
      return errorResponse("VALIDATION_ERROR", "缺少必填字段 taskId 或 isCompleted")
    }

    // 查询任务归属人（仅取 userId，用于越权校验）
    const existing = await prisma.dailyTask.findFirst({
      where: { id: taskId },
      select: { userId: true },
    })
    // 校验任务归属权，防止水平越权（其他用户篡改不属于自己的任务）
    if (!verifyTaskOwnership(existing?.userId ?? null, userId)) {
      return errorResponse("NOT_FOUND", "任务不存在或无权操作")
    }

    const updated = await prisma.dailyTask.update({
      where: { id: taskId },
      data: { isCompleted },
    })

    return successResponse(updated)
  } catch (error) {
    console.error("更新任务状态失败:", error)
    return errorResponse("INTERNAL_ERROR", "更新任务状态失败")
  }
}

// POST: 创建任务（手动添加或将路线图 Action 转为每日任务）
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return errorResponse("UNAUTHORIZED", "未登录，请先登录")
    }

    // 速率限制：每用户每分钟最多 30 次写入，防止恶意刷数据
    const { success } = await checkRateLimit(userId, 30, 60_000)
    if (!success) {
      return errorResponse("RATE_LIMIT_EXCEEDED", "请求过于频繁，请稍后再试", { headers: { "Retry-After": "60" } })
    }

    const body = await request.json()
    const parsed = createTaskSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "输入校验失败",
        undefined,
        parsed.error.flatten().fieldErrors
      )
    }

    // dueDate 缺省为今天（每日任务场景）
    const dueDate = parsed.data.dueDate ?? new Date()

    const task = await prisma.dailyTask.create({
      data: {
        userId,
        title: parsed.data.title,
        description: parsed.data.description ?? "",
        priority: parsed.data.priority ?? 0,
        estimatedMinutes: parsed.data.estimatedMinutes ?? 30,
        dueDate,
      },
    })

    console.info(`用户 ${userId} 创建任务: ${task.id}`)
    return successResponse(task, { status: 201 })
  } catch (error) {
    console.error("创建任务失败:", error)
    return errorResponse("INTERNAL_ERROR", "创建任务失败")
  }
}
