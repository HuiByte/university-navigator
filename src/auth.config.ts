import GitHub from "next-auth/providers/github"
import type { NextAuthConfig } from "next-auth"
import { env } from "@/lib/env"

/**
 * Auth.js 基础配置（Edge Runtime 安全）
 * 仅包含 providers 和 session 策略，不导入 Prisma 等 Node.js 原生模块依赖。
 * 供 middleware.ts 在 Edge Runtime 中使用，避免 node:util/types 等原生模块报错。
 */
export const authConfig = {
  providers: [
    GitHub({
      clientId: env.AUTH_GITHUB_ID,
      clientSecret: env.AUTH_GITHUB_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  secret: env.AUTH_SECRET,
  callbacks: {
    // JWT 策略下 token.sub 即用户 ID，注入 session.user.id
    // 解决 GitHub 登录无 email 时 getAuthenticatedUserId 返回 null 的鉴权失效问题
    session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub
      }
      return session
    },
  },
} satisfies NextAuthConfig
