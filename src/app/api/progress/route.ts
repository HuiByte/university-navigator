import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId } from "@/lib/auth-utils"
import { errorResponse, successResponse } from "@/lib/api-response"
import { aggregateByDay } from "@/lib/progress-utils"

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return errorResponse("UNAUTHORIZED", "未登录，请先登录")
    }

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // ---- 基础统计 ----

    // 总学习天数（打卡记录数）
    const totalStudyDays = await prisma.checkInRecord.count({
      where: { userId },
    })

    // 已完成任务数 & 总任务数
    const [completedTasks, totalTasks] = await Promise.all([
      prisma.dailyTask.count({
        where: { userId, isCompleted: true },
      }),
      prisma.dailyTask.count({
        where: { userId },
      }),
    ])

    // 完成率
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    // 当前连续打卡天数：取最近一条打卡记录的 streakCount
    const latestCheckIn = await prisma.checkInRecord.findFirst({
      where: { userId },
      orderBy: { date: "desc" },
    })

    // 校验最近打卡是否为今天或昨天（连续才有效）
    let currentStreak = 0
    if (latestCheckIn) {
      const lastDate = new Date(latestCheckIn.date)
      const lastDateOnly = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate())
      const yesterday = new Date(todayStart.getTime() - 86400000)
      if (lastDateOnly.getTime() === todayStart.getTime() || lastDateOnly.getTime() === yesterday.getTime()) {
        currentStreak = latestCheckIn.streakCount
      }
    }

    // ---- 趋势数据：最近 7 天 & 上周 7 天的每日完成任务数 ----

    // 本周：最近 7 天（含今天）
    const thisWeekStart = new Date(todayStart.getTime() - 6 * 86400000)
    // 上周：前 7 天
    const lastWeekStart = new Date(todayStart.getTime() - 13 * 86400000)

    // 批量查询本周和上周的任务
    const [thisWeekTasks, lastWeekTasks] = await Promise.all([
      prisma.dailyTask.findMany({
        where: {
          userId,
          dueDate: { gte: thisWeekStart, lt: new Date(todayStart.getTime() + 86400000) },
        },
        select: { dueDate: true, isCompleted: true },
      }),
      prisma.dailyTask.findMany({
        where: {
          userId,
          dueDate: { gte: lastWeekStart, lt: thisWeekStart },
        },
        select: { dueDate: true, isCompleted: true },
      }),
    ])

    const thisWeekTrend = aggregateByDay(thisWeekTasks, thisWeekStart, 7)
    const lastWeekTrend = aggregateByDay(lastWeekTasks, lastWeekStart, 7)

    // 合并趋势数据（用于图表对比展示）
    // 防御：确保两条趋势线长度一致，以较短的为准做 zip
    const trendLength = Math.min(thisWeekTrend.length, lastWeekTrend.length)
    const trendData = thisWeekTrend.slice(0, trendLength).map((item, i) => ({
      date: item.date,
      thisWeek: item.completed,
      lastWeek: lastWeekTrend[i]?.completed ?? 0,
    }))

    // 判断是否有实质数据（至少有一个完成任务或打卡记录）
    const hasData = completedTasks > 0 || totalStudyDays > 0

    return successResponse({
      totalStudyDays,
      completedTasks,
      totalTasks,
      completionRate,
      currentStreak,
      trendData,
      hasData,
    })
  } catch (error) {
    console.error("获取进度数据失败:", error)
    return errorResponse("INTERNAL_ERROR", "获取进度数据失败")
  }
}
