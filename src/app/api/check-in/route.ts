import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId } from "@/lib/auth-utils"
import { errorResponse, successResponse } from "@/lib/api-response"
import { calculateStreak } from "@/lib/checkin-utils"
import { checkRateLimit } from "@/lib/rate-limit"

// POST: 每日打卡，记录学习并更新连续打卡天数（streak）
export async function POST() {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return errorResponse("UNAUTHORIZED", "未登录，请先登录")
    }

    // 速率限制：每用户每分钟最多 30 次写入，防止恶意刷数据
    const { success } = checkRateLimit(userId, 30, 60_000)
    if (!success) {
      return errorResponse("RATE_LIMIT_EXCEEDED", "请求过于频繁，请稍后再试", { headers: { "Retry-After": "60" } })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 检查今天是否已打卡（userId + date 联合唯一）
    const existingCheckIn = await prisma.checkInRecord.findUnique({
      where: { userId_date: { userId, date: today } },
    })

    if (existingCheckIn) {
      return successResponse({
        message: "今天已经打过卡啦！",
        checkIn: existingCheckIn,
        streak: existingCheckIn.streakCount,
      })
    }

    // 查询最近 365 天的历史打卡记录，按时间倒序（用于连续天数计算）
    const recentCheckIns = await prisma.checkInRecord.findMany({
      where: {
        userId,
        date: { gte: new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000) },
      },
      select: { date: true },
      orderBy: { date: "desc" },
    })

    // 连续打卡天数计算委托给纯函数（今天打卡算 1 天，向前回溯连续记录）
    const newStreak = calculateStreak(
      recentCheckIns.map((r) => r.date),
      today
    )

    const checkIn = await prisma.checkInRecord.create({
      data: {
        userId,
        date: today,
        streakCount: newStreak,
      },
    })

    console.info(`用户 ${userId} 打卡成功，连续 ${newStreak} 天`)
    return successResponse(
      { message: "打卡成功！", checkIn, streak: newStreak },
      { status: 201 }
    )
  } catch (error) {
    console.error("打卡失败:", error)
    return errorResponse("INTERNAL_ERROR", "打卡失败")
  }
}
