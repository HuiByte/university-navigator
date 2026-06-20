/*
 * @Author: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @Date: 2026-06-18 13:55:53
 * @LastEditors: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @LastEditTime: 2026-06-19 10:15:08
 * @FilePath: \AI创作力大赛\university-navigator\src\app\api\progress\ai-summary\route.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { streamText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUserId } from "@/lib/auth-utils"

export async function POST() {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return Response.json({ error: "未登录，请先登录" }, { status: 401 })
    }

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // 聚合本周数据
    const weekStart = new Date(todayStart.getTime() - 6 * 86400000)

    const [checkInCount, weekTasks, totalCompleted, totalAll] = await Promise.all([
      prisma.checkInRecord.count({
        where: {
          userId,
          date: { gte: weekStart },
        },
      }),
      prisma.dailyTask.findMany({
        where: {
          userId,
          dueDate: { gte: weekStart, lt: new Date(todayStart.getTime() + 86400000) },
        },
        select: { isCompleted: true },
      }),
      prisma.dailyTask.count({
        where: { userId, isCompleted: true },
      }),
      prisma.dailyTask.count({
        where: { userId },
      }),
    ])

    const weekCompleted = weekTasks.filter((t) => t.isCompleted).length
    const weekTotal = weekTasks.length
    const weekRate = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0
    const overallRate = totalAll > 0 ? Math.round((totalCompleted / totalAll) * 100) : 0

    const systemPrompt = `你是一位温暖、有洞察力的 AI 学长，擅长根据数据给出鼓励和建设性建议。请根据以下本周学习数据，生成一段总结。

## 本周数据：
- 本周打卡天数：${checkInCount} 天
- 本周任务完成率：${weekRate}%（${weekCompleted}/${weekTotal}）
- 累计总完成率：${overallRate}%（${totalCompleted}/${totalAll}）

## 输出格式要求：
请按以下结构输出，使用 Markdown 格式：

### 🌟 本周闪光点
（根据数据，找出本周值得鼓励的地方，2-3 句话，语气温暖）

### 📈 下周改进建议
（给出 2-3 条具体的、可操作的建议，帮助下周做得更好）

### 💬 学长寄语
（一句简短有力的话，激励继续前行）

注意：
- 语气亲切，像学长和朋友一样
- 建议要具体可执行，不要空泛
- 如果数据表现好，要充分鼓励；如果数据一般，要温和地指出改进方向
- 用中文回答`

    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    })

    const result = streamText({
      model: openai(process.env.OPENAI_MODEL || "deepseek-chat"),
      system: systemPrompt,
      prompt: "请根据我的本周学习数据，生成一段总结。",
    })

    return result.toTextStreamResponse()
  } catch (error) {
    console.error("AI 周报总结失败:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "AI 周报总结失败" },
      { status: 500 }
    )
  }
}
