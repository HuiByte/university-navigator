"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Sparkles, Loader2, AlertTriangle } from "lucide-react"

const planFormSchema = z.object({
  major: z.string().min(1, "请输入你的专业"),
  grade: z.string().min(1, "请选择你的年级"),
  degree: z.string().min(1, "请选择你的学历"),
  goal: z.string().min(1, "请输入你的目标").max(500, "目标描述不超过500字"),
  strengths: z.string().min(1, "请输入你的优点"),
  weaknesses: z.string().min(1, "请输入你的缺点"),
  extraInfo: z.string().optional(),
})

type PlanFormData = z.infer<typeof planFormSchema>

export default function PlanPage() {
  const [generatedPlan, setGeneratedPlan] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PlanFormData>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      major: "",
      grade: "",
      degree: "",
      goal: "",
      strengths: "",
      weaknesses: "",
      extraInfo: "",
    },
  })

  async function onSubmit(data: PlanFormData) {
    setIsGenerating(true)
    setGeneratedPlan("")
    setGenerateError(null)

    try {
      const response = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("请求失败，错误信息:", errorData)
        setGenerateError(errorData.error || "生成失败，请稍后重试")
        return
      }

      const result = await response.json()

      setGeneratedPlan(result.plan || "")
    } catch (error) {
      console.error("网络请求失败:", error)
      setGenerateError("网络请求失败，请检查网络连接")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">智能规划</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          填写你的个人信息，AI 将为你量身定制大学规划方案
        </p>
      </div>

      {/* 信息收集表单 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            个人信息
          </CardTitle>
          <CardDescription>
            请如实填写以下信息，以便 AI 生成更精准的规划建议
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* 第一行：专业 + 年级 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="major">专业</Label>
                <Input
                  id="major"
                  placeholder="例如：计算机科学与技术"
                  {...register("major")}
                />
                {errors.major && (
                  <p className="text-sm text-destructive">{errors.major.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="grade">年级</Label>
                <Select id="grade" {...register("grade")}>
                  <option value="">请选择年级</option>
                  <option value="大一">大一</option>
                  <option value="大二">大二</option>
                  <option value="大三">大三</option>
                  <option value="大四">大四</option>
                  <option value="研一">研一</option>
                  <option value="研二">研二</option>
                  <option value="研三">研三</option>
                  <option value="博一">博一</option>
                  <option value="博二">博二</option>
                  <option value="博三">博三</option>
                </Select>
                {errors.grade && (
                  <p className="text-sm text-destructive">{errors.grade.message}</p>
                )}
              </div>
            </div>

            {/* 第二行：学历 */}
            <div className="space-y-2">
              <Label htmlFor="degree">学历</Label>
              <Select id="degree" {...register("degree")}>
                <option value="">请选择学历</option>
                <option value="本科">本科</option>
                <option value="硕士">硕士</option>
                <option value="博士">博士</option>
              </Select>
              {errors.degree && (
                <p className="text-sm text-destructive">{errors.degree.message}</p>
              )}
            </div>

            {/* 第三行：目标 */}
            <div className="space-y-2">
              <Label htmlFor="goal">目标</Label>
              <Textarea
                id="goal"
                placeholder="例如：毕业后进入互联网大厂做后端开发，或者考研到985高校..."
                rows={3}
                {...register("goal")}
              />
              {errors.goal && (
                <p className="text-sm text-destructive">{errors.goal.message}</p>
              )}
            </div>

            {/* 第四行：优点 + 缺点 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="strengths">优点</Label>
                <Textarea
                  id="strengths"
                  placeholder="例如：逻辑思维强、自学能力好、有团队精神..."
                  rows={3}
                  {...register("strengths")}
                />
                {errors.strengths && (
                  <p className="text-sm text-destructive">{errors.strengths.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="weaknesses">缺点</Label>
                <Textarea
                  id="weaknesses"
                  placeholder="例如：容易拖延、英语口语较弱、缺乏项目经验..."
                  rows={3}
                  {...register("weaknesses")}
                />
                {errors.weaknesses && (
                  <p className="text-sm text-destructive">{errors.weaknesses.message}</p>
                )}
              </div>
            </div>

            {/* 第五行：补充信息 */}
            <div className="space-y-2">
              <Label htmlFor="extraInfo">补充信息（选填）</Label>
              <Textarea
                id="extraInfo"
                placeholder="任何你想让 AI 知道的额外信息，如已有证书、实习经历、兴趣爱好等..."
                rows={2}
                {...register("extraInfo")}
              />
            </div>

            {/* 提交按钮 */}
            <Button type="submit" size="lg" className="w-full" disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  AI 规划生成中...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  生成 AI 规划
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* AI 规划结果展示 */}
      {(generatedPlan || isGenerating || generateError) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">AI 规划方案</CardTitle>
            <CardDescription>
              {isGenerating ? "正在为你生成规划，请稍候..." : "以下是根据你的信息生成的个性化规划"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {generateError ? (
              <div className="flex items-start gap-3 rounded-md bg-destructive/5 border border-destructive/30 p-4">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">生成失败</p>
                  <p className="text-sm text-muted-foreground mt-1">{generateError}</p>
                </div>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none rounded-md bg-muted/50 p-4 sm:p-6">
                {isGenerating && !generatedPlan ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>AI 正在思考中...</span>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                    {generatedPlan}
                    {isGenerating && <span className="animate-pulse">|</span>}
                  </pre>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
