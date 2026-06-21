"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AIChatDrawer } from "@/components/AIChatDrawer"
import { cn } from "@/lib/utils"
import { Check, HelpCircle, Plus, Clock, AlertTriangle, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"

// ---- 类型定义 ----
type DailyTask = {
  id: string
  title: string
  description: string
  isCompleted: boolean
  priority: number
  estimatedMinutes: number
  dueDate: string
}

type EnergyLevel = "full" | "normal" | "low"

// ---- 工具函数 ----
function getGreeting(): { text: string; emoji: string } {
  const hour = new Date().getHours()
  if (hour < 6) return { text: "夜深了，注意休息", emoji: "🌙" }
  if (hour < 12) return { text: "早安，新的一天开始了", emoji: "☀️" }
  if (hour < 14) return { text: "午安，吃饱了才有力气", emoji: "🍱" }
  if (hour < 18) return { text: "下午好，保持节奏", emoji: "🌤️" }
  return { text: "晚上好，今天辛苦了", emoji: "🌆" }
}

function getEnergyConfig(level: EnergyLevel) {
  const configs: Record<EnergyLevel, { label: string; emoji: string; color: string }> = {
    full: { label: "精力充沛", emoji: "🔋", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
    normal: { label: "状态一般", emoji: "😐", color: "bg-amber-100 text-amber-700 border-amber-300" },
    low: { label: "有点疲惫", emoji: "🪫", color: "bg-rose-100 text-rose-700 border-rose-300" },
  }
  return configs[level]
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<DailyTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [energy, setEnergy] = useState<EnergyLevel>("normal")
  const [chatOpen, setChatOpen] = useState(false)
  const [initialMessage, setInitialMessage] = useState<string | null>(null)

  // 获取今日任务
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await apiFetch<DailyTask[]>("/api/tasks", { showToast: false })
      setTasks(data || [])
    } catch (error) {
      const message = error instanceof Error ? error.message : "获取任务失败"
      toast.error(message)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // 切换任务完成状态
  const toggleTask = async (taskId: string, currentCompleted: boolean) => {
    // 乐观更新
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, isCompleted: !currentCompleted } : t))
    )
    try {
      await apiFetch("/api/tasks", {
        method: "PATCH",
        body: { taskId, isCompleted: !currentCompleted },
        showToast: false,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新任务状态失败")
      // 回滚
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, isCompleted: currentCompleted } : t))
      )
    }
  }

  // 打开 AI 学长聊天，发送预设消息
  const openChatWithTask = (taskTitle: string) => {
    setInitialMessage(`学长，我正在做任务：${taskTitle}，我感觉有点卡壳，能给我一点提示吗？`)
    setChatOpen(true)
  }

  // 计算今日完成率
  const completedCount = tasks.filter((t) => t.isCompleted).length
  const totalCount = tasks.length
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  // 提取今日焦点（第一个未完成且优先级最高的任务）
  const focusTask = tasks.find((t) => !t.isCompleted)

  // 根据精力状态判断任务是否应降级（疲惫时，>45分钟的任务置灰）
  const isTaskDemoted = (task: DailyTask) =>
    energy === "low" && task.estimatedMinutes > 45 && !task.isCompleted

  const greeting = getGreeting()

  return (
    <div className="space-y-6">
      {/* ========== 模块 1：AI 问候卡片 ========== */}
      <Card className="border-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardContent className="flex items-center justify-between py-4 sm:py-5">
          <div>
            <p className="text-base font-medium sm:text-lg">
              {greeting.emoji} {greeting.text}
            </p>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {totalCount > 0
                ? `今日已完成 ${completedCount}/${totalCount} 项任务（${completionRate}%）`
                : "今天还没有任务，点击下方添加吧"}
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-primary sm:text-3xl">{completionRate}%</span>
            <p className="text-xs text-muted-foreground">完成率</p>
          </div>
        </CardContent>
      </Card>

      {/* ========== 模块 2：今日唯一焦点 ========== */}
      {focusTask && (
        <Card className="border-2 border-primary/20 shadow-lg shadow-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
              🎯 今日核心焦点
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold sm:text-2xl">{focusTask.title}</p>
            <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                预估 {focusTask.estimatedMinutes} 分钟
              </span>
              {focusTask.description && (
                <span className="truncate max-w-[120px] sm:max-w-[200px]">{focusTask.description}</span>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <Button size="sm" onClick={() => toggleTask(focusTask.id, focusTask.isCompleted)}>
                <Check className="mr-1 h-4 w-4" />
                完成它
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openChatWithTask(focusTask.title)}
              >
                <HelpCircle className="mr-1 h-4 w-4" />
                卡壳了
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========== 模块 3：状态微调器 ========== */}
      <div>
        <p className="mb-3 text-sm font-medium text-muted-foreground">现在的状态如何？</p>
        <div className="flex gap-2">
          {(["full", "normal", "low"] as EnergyLevel[]).map((level) => {
            const config = getEnergyConfig(level)
            const isActive = energy === level
            return (
              <button
                key={level}
                onClick={() => setEnergy(level)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-all",
                  isActive ? config.color : "border-border bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                <span>{config.emoji}</span>
                <span>{config.label}</span>
              </button>
            )
          })}
        </div>
        {energy === "low" && (
          <p className="mt-2 text-xs text-rose-600">
            💡 疲惫模式下，超过 45 分钟的任务已自动降级，建议先做简单的任务热身
          </p>
        )}
      </div>

      {/* ========== 模块 4：弹性任务流 ========== */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">今日任务流</p>
          <span className="text-xs text-muted-foreground">{completedCount}/{totalCount} 已完成</span>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="flex items-center gap-3 py-3">
                  <Skeleton className="h-5 w-5 shrink-0 rounded" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
              <p className="text-sm text-destructive mb-3">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchTasks} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                重新加载
              </Button>
            </CardContent>
          </Card>
        ) : tasks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <Plus className="mb-2 h-8 w-8" />
              <p className="text-sm">暂无今日任务</p>
              <p className="mt-1 text-xs">在路线图中生成的任务会出现在这里</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => {
              const demoted = isTaskDemoted(task)
              return (
                <Card
                  key={task.id}
                  className={cn(
                    "transition-all duration-300",
                    demoted && "opacity-40",
                    task.isCompleted && "opacity-60"
                  )}
                >
                  <CardContent className="flex items-center gap-3 py-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleTask(task.id, task.isCompleted)}
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                        task.isCompleted
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/30 hover:border-primary"
                      )}
                    >
                      {task.isCompleted && <Check className="h-3 w-3" />}
                    </button>

                    {/* 任务内容 */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium transition-all duration-300",
                          task.isCompleted && "line-through text-muted-foreground"
                        )}
                      >
                        {task.title}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {task.estimatedMinutes}min
                        </span>
                        {task.priority > 0 && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            P{task.priority}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 卡壳了按钮 */}
                    {!task.isCompleted && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 text-xs text-muted-foreground hover:text-primary"
                        onClick={() => openChatWithTask(task.title)}
                      >
                        🆘 卡壳了
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* ========== AI 学长聊天抽屉 ========== */}
      <AIChatDrawer
        open={chatOpen}
        onClose={() => {
          setChatOpen(false)
          setInitialMessage(null)
        }}
        energy={energy}
        initialMessage={initialMessage}
      />
    </div>
  )
}
