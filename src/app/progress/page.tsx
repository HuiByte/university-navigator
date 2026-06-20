"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  BookOpen,
  CheckCircle2,
  Flame,
  TrendingUp,
  Loader2,
  Sparkles,
  Code2,
  Languages,
  Users,
  Lightbulb,
  GraduationCap,
  Target,
  AlertTriangle,
  RefreshCw,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

// ---- 类型定义 ----
type ProgressData = {
  totalStudyDays: number
  completedTasks: number
  totalTasks: number
  completionRate: number
  currentStreak: number
  trendData: {
    date: string
    thisWeek: number
    lastWeek: number
  }[]
}

type SkillNode = {
  id: string
  name: string
  icon: React.ReactNode
  threshold: number // 完成率阈值，达到则点亮
  color: string
}

// ---- 技能树配置 ----
const SKILL_TREE: SkillNode[] = [
  { id: "major", name: "专业技能", icon: <Code2 className="h-5 w-5" />, threshold: 20, color: "text-blue-500 bg-blue-50 border-blue-200" },
  { id: "english", name: "英语能力", icon: <Languages className="h-5 w-5" />, threshold: 35, color: "text-emerald-500 bg-emerald-50 border-emerald-200" },
  { id: "soft", name: "软技能", icon: <Users className="h-5 w-5" />, threshold: 50, color: "text-amber-500 bg-amber-50 border-amber-200" },
  { id: "innovation", name: "创新思维", icon: <Lightbulb className="h-5 w-5" />, threshold: 65, color: "text-purple-500 bg-purple-50 border-purple-200" },
  { id: "academic", name: "学术素养", icon: <GraduationCap className="h-5 w-5" />, threshold: 80, color: "text-rose-500 bg-rose-50 border-rose-200" },
  { id: "mastery", name: "全面精通", icon: <Target className="h-5 w-5" />, threshold: 95, color: "text-orange-500 bg-orange-50 border-orange-200" },
]

export default function ProgressPage() {
  const [data, setData] = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aiSummary, setAiSummary] = useState("")
  const [aiLoading, setAiLoading] = useState(false)

  // 获取进度数据
  const fetchProgress = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch("/api/progress")
      if (res.ok) {
        const { data } = await res.json()
        setData(data)
      } else {
        setError("获取进度数据失败")
      }
    } catch {
      setError("网络请求失败，请检查网络连接")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProgress()
  }, [fetchProgress])

  // AI 周报总结（流式输出）
  const fetchAiSummary = async () => {
    if (aiLoading) return
    setAiLoading(true)
    setAiSummary("")
    try {
      const res = await fetch("/api/progress/ai-summary", { method: "POST" })
      if (!res.ok || !res.body) {
        setAiSummary("生成失败，请稍后重试")
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let done = false
      while (!done) {
        const { value, done: streamDone } = await reader.read()
        done = streamDone
        if (value) {
          setAiSummary((prev) => prev + decoder.decode(value, { stream: true }))
        }
      }
    } catch (error) {
      console.error("AI 总结失败:", error)
      setAiSummary("生成失败，请稍后重试")
    } finally {
      setAiLoading(false)
    }
  }

  const completionRate = data?.completionRate ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">学习进度</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">追踪你的成长轨迹，每一步都算数</p>
        </div>
      </div>

      {/* ========== 顶部：4 个数据卡片 ========== */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="mb-2 h-4 w-20" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
            <p className="text-sm text-destructive mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchProgress} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              重新加载
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={<BookOpen className="h-5 w-5 text-blue-500" />}
            label="总学习天数"
            value={data?.totalStudyDays ?? 0}
            suffix="天"
            gradient="from-blue-500/10 to-blue-500/5"
          />
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            label="已完成任务"
            value={data?.completedTasks ?? 0}
            suffix={`/${data?.totalTasks ?? 0}`}
            gradient="from-emerald-500/10 to-emerald-500/5"
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5 text-amber-500" />}
            label="完成率"
            value={completionRate}
            suffix="%"
            gradient="from-amber-500/10 to-amber-500/5"
          />
          <StatCard
            icon={<Flame className="h-5 w-5 text-rose-500" />}
            label="连续打卡"
            value={data?.currentStreak ?? 0}
            suffix="天"
            gradient="from-rose-500/10 to-rose-500/5"
          />
        </div>
      )}

      {/* ========== 中部：趋势图 + 技能树 ========== */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* 左侧：本周学习趋势 */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              本周学习趋势
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (data?.trendData?.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data?.trendData ?? []} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(214.3 31.8% 91.4%)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "hsl(215.4 16.3% 46.9%)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: "hsl(215.4 16.3% 46.9%)" }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid hsl(214.3 31.8% 91.4%)",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                      fontSize: "13px",
                    }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    iconType="circle"
                    iconSize={8}
                    formatter={(value: string) => (
                      <span style={{ fontSize: "12px", color: "hsl(215.4 16.3% 46.9%)" }}>
                        {value === "thisWeek" ? "本周" : "上周"}
                      </span>
                    )}
                  />
                  <Bar
                    dataKey="lastWeek"
                    fill="hsl(214.3 31.8% 91.4%)"
                    radius={[4, 4, 0, 0]}
                    name="lastWeek"
                  />
                  <Bar
                    dataKey="thisWeek"
                    fill="hsl(221.2 83.2% 53.3%)"
                    radius={[4, 4, 0, 0]}
                    name="thisWeek"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[260px] items-center justify-center text-muted-foreground">
                暂无趋势数据
              </div>
            )}
          </CardContent>
        </Card>

        {/* 右侧：技能树 */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              技能树
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {SKILL_TREE.map((skill) => {
                  const isUnlocked = completionRate >= skill.threshold
                  const progress = Math.min(
                    100,
                    Math.max(0, ((completionRate - skill.threshold + 20) / 20) * 100)
                  )
                  return (
                    <div
                      key={skill.id}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3 transition-all duration-300",
                        isUnlocked
                          ? skill.color
                          : "border-border bg-muted/30 text-muted-foreground"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-all",
                          isUnlocked
                            ? "bg-white/80 shadow-sm"
                            : "bg-muted"
                        )}
                      >
                        {skill.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{skill.name}</span>
                          {isUnlocked ? (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              已解锁
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">
                              需 {skill.threshold}% 完成率
                            </span>
                          )}
                        </div>
                        {/* 进度条 */}
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              isUnlocked ? "bg-current opacity-60" : "bg-muted-foreground/30"
                            )}
                            style={{ width: `${isUnlocked ? 100 : progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ========== 底部：AI 周报总结 ========== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            AI 周报总结
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!aiSummary && !aiLoading && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <p className="mb-3 text-sm text-muted-foreground">
                让 AI 学长帮你总结本周表现，给出鼓励和建议
              </p>
              <Button onClick={fetchAiSummary} disabled={loading}>
                <Sparkles className="mr-2 h-4 w-4" />
                获取本周 AI 总结
              </Button>
            </div>
          )}

          {aiLoading && !aiSummary && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">AI 正在生成总结...</span>
            </div>
          )}

          {aiSummary && (
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{aiSummary}</div>
            </div>
          )}

          {aiSummary && !aiLoading && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={fetchAiSummary}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                重新生成
              </Button>
            </div>
          )}

          {aiLoading && aiSummary && (
            <div className="flex items-center text-xs text-muted-foreground">
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              生成中...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---- 统计卡片组件 ----
function StatCard({
  icon,
  label,
  value,
  suffix,
  gradient,
}: {
  icon: React.ReactNode
  label: string
  value: number
  suffix: string
  gradient: string
}) {
  return (
    <Card className={cn("border-0 bg-gradient-to-br", gradient)}>
      <CardContent className="p-5">
        <div className="mb-2 flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <div className="flex items-baseline gap-0.5">
          <span className="text-2xl font-bold">{value}</span>
          <span className="text-sm text-muted-foreground">{suffix}</span>
        </div>
      </CardContent>
    </Card>
  )
}
