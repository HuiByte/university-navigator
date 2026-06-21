import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId } from "@/lib/auth-utils"
import { errorResponse, successResponse } from "@/lib/api-response"
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

    return Response.json({ data: tasks })
  } catch (error) {
    console.error("获取任务列表失败:", error)
    return Response.json(
      { error: "获取任务列表失败" },
      { status: 500 }
    )
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
      return Response.json(
        { error: "缺少必填字段 taskId 或 isCompleted" },
        { status: 400 }
      )
    }

    // 校验任务归属权，防止水平越权（其他用户篡改不属于自己的任务）
    const existing = await prisma.dailyTask.findFirst({
      where: { id: taskId, userId },
      select: { id: true },
    })
    if (!existing) {
      return Response.json(
        { error: "任务不存在或无权操作" },
        { status: 404 }
      )
    }

    const updated = await prisma.dailyTask.update({
      where: { id: taskId },
      data: { isCompleted },
    })

    return Response.json({ data: updated })
  } catch (error) {
    console.error("更新任务状态失败:", error)
    return Response.json(
      { error: "更新任务状态失败" },
      { status: 500 }
    )
  }
}

// POST: 创建任务（手动添加或将路线图 Action 转为每日任务）
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return errorResponse("UNAUTHORIZED", "未登录，请先登录")
    }

    const body = await request.json()
    const parsed = createTaskSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { error: "输入校验失败", details: parsed.error.flatten() },
        { status: 400 }
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
    return Response.json({ data: task }, { status: 201 })
  } catch (error) {
    console.error("创建任务失败:", error)
    return Response.json(
      { error: "创建任务失败" },
      { status: 500 }
    )
  }
}
