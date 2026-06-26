import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId } from "@/lib/auth-utils"
import { errorResponse, successResponse } from "@/lib/api-response"
import { verifyTaskOwnership } from "@/lib/task-utils"
import { checkRateLimit } from "@/lib/rate-limit"
import { getDayRange } from "@/lib/date-utils"
import { z } from "zod"

// 创建任务校验：title 必填，dueDate 缺省为今天，priority/estimatedMinutes 可选
const createTaskSchema = z.object({
  title: z.string().min(1, "任务标题不能为空").max(100),
  description: z.string().optional(),
  priority: z.number().int().min(0).max(5).optional(),
  estimatedMinutes: z.number().int().min(1).max(480).optional(),
  dueDate: z.coerce.date().optional(),
})

// 更新任务字段校验：所有字段可选（PUT 仅更新传入字段）
const updateTaskFieldsSchema = z.object({
  title: z.string().min(1, "任务标题不能为空").max(100).optional(),
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

    // 今日 [start, end) 半开区间（按默认时区 Asia/Shanghai 计算当日边界）
    const { start, end } = getDayRange()

    const tasks = await prisma.dailyTask.findMany({
      where: {
        userId,
        dueDate: {
          gte: start,
          lt: end,
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

// DELETE: 删除任务（物理删除，已完成任务也一并删除）
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return errorResponse("UNAUTHORIZED", "未登录，请先登录")
    }

    const body = await request.json()
    const { taskId } = body as { taskId?: string }

    // taskId 必填校验
    if (!taskId || typeof taskId !== "string") {
      return errorResponse("VALIDATION_ERROR", "缺少必填字段 taskId", undefined, {
        taskId: ["taskId 不能为空"],
      })
    }

    // 查询任务归属人（仅取 userId，用于越权校验）
    const existing = await prisma.dailyTask.findFirst({
      where: { id: taskId },
      select: { userId: true },
    })
    // 校验任务归属权，防止水平越权（其他用户删除不属于自己的任务）
    if (!verifyTaskOwnership(existing?.userId ?? null, userId)) {
      return errorResponse("NOT_FOUND", "任务不存在或无权操作")
    }

    await prisma.dailyTask.delete({ where: { id: taskId } })

    console.info(`用户 ${userId} 删除任务: ${taskId}`)
    return successResponse({ id: taskId })
  } catch (error) {
    console.error("删除任务失败:", error)
    return errorResponse("INTERNAL_ERROR", "删除任务失败")
  }
}

// PUT: 更新任务字段（title/description/priority/estimatedMinutes/dueDate）
export async function PUT(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return errorResponse("UNAUTHORIZED", "未登录，请先登录")
    }

    const body = await request.json()
    const { taskId, ...fields } = body as { taskId?: string } & Record<string, unknown>

    // taskId 单独校验（不放入 fields schema，避免与可更新字段混淆）
    if (!taskId || typeof taskId !== "string") {
      return errorResponse("VALIDATION_ERROR", "缺少必填字段 taskId", undefined, {
        taskId: ["taskId 不能为空"],
      })
    }

    // 校验可更新字段（所有字段可选）
    const fieldsParsed = updateTaskFieldsSchema.safeParse(fields)
    if (!fieldsParsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "输入校验失败",
        undefined,
        fieldsParsed.error.flatten().fieldErrors
      )
    }

    // 过滤掉 undefined 字段，仅保留实际传入的值
    const updateData = Object.fromEntries(
      Object.entries(fieldsParsed.data).filter(([, v]) => v !== undefined)
    )
    // 至少提供 1 个可更新字段
    if (Object.keys(updateData).length === 0) {
      return errorResponse("VALIDATION_ERROR", "至少需要提供 1 个可更新字段", undefined, {
        form: ["可更新字段：title/description/priority/estimatedMinutes/dueDate"],
      })
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
      data: updateData,
    })

    console.info(`用户 ${userId} 更新任务: ${taskId}`)
    return successResponse(updated)
  } catch (error) {
    console.error("更新任务失败:", error)
    return errorResponse("INTERNAL_ERROR", "更新任务失败")
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
