/*
 * @Author: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @Date: 2026-06-18 14:16:34
 * @LastEditors: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @LastEditTime: 2026-06-18 14:16:36
 * @FilePath: \AI创作力大赛\university-navigator\src\app\error.tsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, RefreshCw } from "lucide-react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("全局错误:", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="max-w-md w-full border-destructive/30">
        <CardContent className="flex flex-col items-center py-10 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">出了点问题</h2>
          <p className="text-sm text-muted-foreground mb-6">
            页面加载时发生了错误，请尝试刷新页面
          </p>
          <Button onClick={reset} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            重新加载
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
