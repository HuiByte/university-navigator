import { DefaultSession } from "next-auth"

/**
 * Auth.js v5 类型增强
 * 在 Session.user 中注入 id 字段（来自 JWT token.sub），
 * 使 getAuthenticatedUserId 可直接读取用户 ID，无需依赖 email 查库
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string
    } & DefaultSession["user"]
  }
}
