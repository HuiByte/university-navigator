"use client"

import React, { useRef, useEffect, useState, useMemo } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { X, Send, GraduationCap, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AIChatDrawerProps = {
  open: boolean
  onClose: () => void
  energy: string
  initialMessage?: string | null
}

export function AIChatDrawer({ open, onClose, energy, initialMessage }: AIChatDrawerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const initialMessageSent = useRef(false)
  const [input, setInput] = useState("")
  // 标记是否正在处理"卡壳了"触发的初始任务分析
  const [analyzingTask, setAnalyzingTask] = useState(false)

  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    body: { energy },
  }), [energy])

  const { messages, sendMessage, status, reload } = useChat({
    transport,
    onError() {
      setAnalyzingTask(false)
      toast.error("AI 响应意外中断，请检查网络或重试", {
        action: {
          label: "重试",
          onClick: () => reload(),
        },
      })
    },
  })

  const isLoading = status === "submitted" || status === "streaming"

  // 当 initialMessage 变化时，自动发送预设消息（"卡壳了"场景）
  useEffect(() => {
    if (initialMessage && !initialMessageSent.current) {
      initialMessageSent.current = true
      setAnalyzingTask(true)
      sendMessage({ text: initialMessage })
    }
  }, [initialMessage, sendMessage])

  // 当 AI 开始流式输出或回到就绪状态时，结束"正在分析"提示
  useEffect(() => {
    if (status === "streaming" || status === "ready") {
      setAnalyzingTask(false)
    }
  }, [status])

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput("")
  }

  // 从 UIMessage 的 parts 中提取文本内容
  const getMessageText = (msg: (typeof messages)[number]): string => {
    return msg.parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("")
  }

  if (!open) return null

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 z-40 bg-black/40 transition-opacity"
        onClick={onClose}
      />

      {/* 抽屉主体 */}
      <div
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l bg-background shadow-2xl",
          "animate-in slide-in-from-right duration-300"
        )}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <span className="font-semibold">AI 学长</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* 消息列表 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <GraduationCap className="mb-3 h-10 w-10 text-primary/50" />
              <p className="text-sm">有什么卡壳的地方？问问 AI 学长吧</p>
            </div>
          )}
          {messages.map((msg) => {
            const text = getMessageText(msg)
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  <div className="whitespace-pre-wrap">{text}</div>
                </div>
              </div>
            )
          })}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1.5 rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{analyzingTask ? "正在分析当前任务..." : "思考中..."}</span>
              </div>
            </div>
          )}
        </div>

        {/* 输入区域 */}
        <div className="border-t p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入你的问题..."
              className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </>
  )
}
