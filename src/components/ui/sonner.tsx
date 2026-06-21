"use client"

import { Toaster as SonnerToaster } from "sonner"

/**
 * 全局 Toast 通知容器
 * 挂载于 RootLayout，所有页面通过 sonner 的 toast() 函数触发通知
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "rounded-lg border border-border bg-card text-card-foreground shadow-lg",
          title: "text-sm font-medium",
          description: "text-sm text-muted-foreground",
        },
      }}
    />
  )
}
