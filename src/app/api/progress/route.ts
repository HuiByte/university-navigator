import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId } from "@/lib/auth-utils"
import { errorResponse, successResponse } from "@/lib/api-response"

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

    // 按日期聚合每日完成任务数
    function aggregateByDay(
      tasks: { dueDate: Date; isCompleted: boolean }[],
      startDay: Date,
      days: number
    ) {
      const result: { date: string; completed: number }[] = []
      for (let i = 0; i < days; i++) {
        const dayStart = new Date(startDay.getTime() + i * 86400000)
        const dayEnd = new Date(dayStart.getTime() + 86400000)
        const dayStr = `${dayStart.getMonth() + 1}/${dayStart.getDate()}`
        const completed = tasks.filter(
          (t) => t.isCompleted && t.dueDate >= dayStart && t.dueDate < dayEnd
        ).length
        result.push({ date: dayStr, completed })
      }
      return result
    }

    const thisWeekTrend = aggregateByDay(thisWeekTasks, thisWeekStart, 7)
    const lastWeekTrend = aggregateByDay(lastWeekTasks, lastWeekStart, 7)

    // 合并趋势数据（用于图表对比展示）
    const trendData = thisWeekTrend.map((item, i) => ({
      date: item.date,
      thisWeek: item.completed,
      lastWeek: lastWeekTrend[i]?.completed || 0,
    }))

    return successResponse({
      totalStudyDays,
      completedTasks,
      totalTasks,
      completionRate,
      currentStreak,
      trendData,
    })
  } catch (error) {
    console.error("获取进度数据失败:", error)
    return errorResponse("INTERNAL_ERROR", "获取进度数据失败")
  }
}
