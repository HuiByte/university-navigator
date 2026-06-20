/*
 * @Author: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @Date: 2026-06-17 22:48:03
 * @LastEditors: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @LastEditTime: 2026-06-18 14:14:39
 * @FilePath: \AI创作力大赛\university-navigator\src\app\page.tsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { GraduationCap } from "lucide-react"

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-8">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-8 w-8 text-primary sm:h-12 sm:w-12" />
        <h1 className="text-2xl font-bold sm:text-4xl">大学导航员</h1>
      </div>
      <p className="text-base text-muted-foreground text-center max-w-md sm:text-lg px-4">
        智能规划你的大学之路，从目标设定到路线图生成，让每一步都清晰可见。
      </p>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-lg w-full px-4">
        <a
          href="/plan"
          className="rounded-lg border bg-card p-4 sm:p-6 text-center hover:bg-accent transition-colors"
        >
          <h3 className="font-semibold text-sm sm:text-base">规划页</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">设定目标与计划</p>
        </a>
        <a
          href="/roadmap"
          className="rounded-lg border bg-card p-4 sm:p-6 text-center hover:bg-accent transition-colors"
        >
          <h3 className="font-semibold text-sm sm:text-base">路线图</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">可视化成长路径</p>
        </a>
        <a
          href="/tasks"
          className="rounded-lg border bg-card p-4 sm:p-6 text-center hover:bg-accent transition-colors"
        >
          <h3 className="font-semibold text-sm sm:text-base">任务页</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">每日任务管理</p>
        </a>
        <a
          href="/progress"
          className="rounded-lg border bg-card p-4 sm:p-6 text-center hover:bg-accent transition-colors"
        >
          <h3 className="font-semibold text-sm sm:text-base">进度页</h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">追踪打卡记录</p>
        </a>
      </div>
    </div>
  )
}
