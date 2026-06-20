/*
 * @Author: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @Date: 2026-06-19 10:29:40
 * @LastEditors: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @LastEditTime: 2026-06-19 10:29:41
 * @FilePath: \AI创作力大赛\university-navigator\src\components\SessionProvider.tsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
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
