"use client"

import { useEffect, useState, useCallback } from "react"
import { RefreshCw, AlertTriangle, Lightbulb, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

interface Stage {
  title: string
  duration: string
  goal: string
  actions: string[]
}

interface RoadmapData {
  stages: Stage[]
  risks: string[]
  suggestions: string[]
}

// 骨架屏组件
function TimelineSkeleton() {
  return (
    <div className="relative pl-8 md:pl-12">
      {/* 时间轴线 */}
      <div className="absolute left-3 md:left-5 top-0 bottom-0 w-0.5 bg-border" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="relative mb-8 last:mb-0">
          {/* 节点圆圈 */}
          <div className="absolute -left-8 md:-left-12 top-2">
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-48 mt-2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  )
}

// 时间轴阶段卡片
function StageCard({ stage, index, isCurrent }: { stage: Stage; index: number; isCurrent: boolean }) {
  return (
    <div className="relative mb-8 last:mb-0 group">
      {/* 时间轴节点 */}
      <div className="absolute -left-8 md:-left-12 top-4 z-10">
        <div
          className={`h-4 w-4 rounded-full border-2 transition-colors ${
            isCurrent
              ? "border-primary bg-primary shadow-md shadow-primary/30"
              : "border-muted-foreground/40 bg-background"
          }`}
        />
        {/* 当前阶段脉冲动画 */}
        {isCurrent && (
          <div className="absolute inset-0 h-4 w-4 rounded-full bg-primary/40 animate-ping" />
        )}
      </div>

      <Card
        className={`transition-all duration-200 ${
          isCurrent
            ? "border-primary/50 shadow-md shadow-primary/5"
            : "hover:border-primary/20 hover:shadow-sm"
        }`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-lg">{stage.title}</CardTitle>
            <Badge variant={isCurrent ? "default" : "secondary"}>
              {stage.duration}
            </Badge>
            {isCurrent && (
              <Badge variant="outline" className="text-primary border-primary/40">
                当前阶段
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{stage.goal}</p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {stage.actions.map((action, actionIdx) => (
              <li key={actionIdx} className="flex items-start gap-2 text-sm">
                <span className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium mt-0.5">
                  {actionIdx + 1}
                </span>
                <span className="text-foreground/80">{action}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

export default function RoadmapPage() {
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noPlan, setNoPlan] = useState(false)

  const fetchRoadmap = useCallback(async () => {
    setLoading(true)
    setError(null)
    setNoPlan(false)
    try {
      const res = await fetch("/api/generate-roadmap")
      const json = await res.json()

      if (!res.ok) {
        setError(json.error || "获取路线图失败")
        return
      }

      if (json.reason === "no_plan") {
        setNoPlan(true)
        return
      }

      if (json.data) {
        setRoadmap(json.data as RoadmapData)
      }
    } catch {
      setError("网络请求失败，请检查网络连接")
    } finally {
      setLoading(false)
    }
  }, [])

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch("/api/generate-roadmap", { method: "POST" })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error || "生成路线图失败")
        return
      }

      if (json.data) {
        setRoadmap(json.data as RoadmapData)
      }
    } catch {
      setError("网络请求失败，请检查网络连接")
    } finally {
      setGenerating(false)
    }
  }, [])

  // 页面加载时获取数据
  useEffect(() => {
    fetchRoadmap()
  }, [fetchRoadmap])

  // 判断当前阶段（简单策略：取第二个阶段为当前，若无则取第一个）
  const currentStageIndex = roadmap
    ? Math.min(1, roadmap.stages.length - 1)
    : -1

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">路线图</h1>
          <p className="text-sm text-muted-foreground mt-1 sm:text-base">可视化你的成长路径和里程碑</p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generating || loading || noPlan}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
          {generating ? "生成中..." : "重新生成路线"}
        </Button>
      </div>

      {/* 无规划提示 */}
      {noPlan && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-lg font-medium">请先完成规划生成</p>
            <p className="text-muted-foreground/70 text-sm mt-1">
              前往「规划」页面生成你的大学规划后，即可生成路线图
            </p>
          </CardContent>
        </Card>
      )}

      {/* 错误提示 */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* 加载骨架屏 */}
      {(loading || generating) && !error && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground animate-pulse">
            {generating ? "AI 正在为你生成路线图..." : "加载中..."}
          </p>
          <TimelineSkeleton />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <Card>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/5" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/5" />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 路线图内容 */}
      {roadmap && !loading && !generating && (
        <div className="space-y-8">
          {/* 垂直时间轴 */}
          <div className="relative pl-8 md:pl-12">
            {/* 时间轴连接线 */}
            <div className="absolute left-3 md:left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/60 via-primary/30 to-border" />

            {roadmap.stages.map((stage, index) => (
              <StageCard
                key={index}
                stage={stage}
                index={index}
                isCurrent={index === currentStageIndex}
              />
            ))}
          </div>

          {/* 风险与建议并排卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 潜在风险 */}
            {roadmap.risks && roadmap.risks.length > 0 && (
              <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    潜在风险
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {roadmap.risks.map((risk, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-amber-800/80 dark:text-amber-300/80">
                        <span className="flex-shrink-0 mt-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
                        {risk}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* 专属建议 */}
            {roadmap.suggestions && roadmap.suggestions.length > 0 && (
              <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-blue-700 dark:text-blue-400">
                    <Lightbulb className="h-4 w-4" />
                    专属建议
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {roadmap.suggestions.map((suggestion, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-blue-800/80 dark:text-blue-300/80">
                        <CheckCircle2 className="flex-shrink-0 h-4 w-4 mt-0.5 text-blue-500" />
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
