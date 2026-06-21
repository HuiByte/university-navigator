import { auth } from "@/auth"

/**
 * 获取当前登录用户的 ID（基于 Auth.js v5 JWT 会话）
 * 直接从 session.user.id 获取（由 session callback 从 token.sub 注入），
 * 不再依赖 email 查询数据库，彻底解决 GitHub 登录无 email 导致鉴权失效的问题
 * @returns 当前用户的 userId，未登录时返回 null
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await auth()
  return session?.user?.id ?? null
}
