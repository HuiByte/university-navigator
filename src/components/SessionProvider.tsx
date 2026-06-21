"use client"

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"

/**
 * 客户端 SessionProvider 包装组件
 * 包裹 next-auth/react 的 SessionProvider，
 * 使所有客户端组件可以通过 useSession 获取会话状态
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
}
