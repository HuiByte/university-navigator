/*
 * @Author: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @Date: 2026-06-19 11:01:08
 * @LastEditors: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @LastEditTime: 2026-06-19 11:26:56
 * @FilePath: \AI创作力大赛\university-navigator\src\app\api\check-in\route.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId } from "@/lib/auth-utils"

// POST: 每日打卡，记录学习并更新连续打卡天数（streak）
export async function POST() {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return Response.json({ error: "未登录，请先登录" }, { status: 401 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 检查今天是否已打卡（userId + date 联合唯一）
    const existingCheckIn = await prisma.checkInRecord.findUnique({
      where: { userId_date: { userId, date: today } },
    })

    if (existingCheckIn) {
      return Response.json({
        message: "今天已经打过卡啦！",
        data: existingCheckIn,
        streak: existingCheckIn.streakCount,
      })
    }

    // 查询昨天的打卡记录以计算连续天数
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const yesterdayCheckIn = await prisma.checkInRecord.findUnique({
      where: { userId_date: { userId, date: yesterday } },
    })

    // 昨天有打卡记录则 streak +1，否则重置为 1
    const newStreak = yesterdayCheckIn ? yesterdayCheckIn.streakCount + 1 : 1

    const checkIn = await prisma.checkInRecord.create({
      data: {
        userId,
        date: today,
        streakCount: newStreak,
      },
    })

    console.info(`用户 ${userId} 打卡成功，连续 ${newStreak} 天`)
    return Response.json(
      { message: "打卡成功！", data: checkIn, streak: newStreak },
      { status: 201 }
    )
  } catch (error) {
    console.error("打卡失败:", error)
    return Response.json({ error: "打卡失败" }, { status: 500 })
  }
}
