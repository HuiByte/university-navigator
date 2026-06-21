import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

/**
 * 获取当前登录用户的 ID（基于 Auth.js session）
 * 通过 session.email 查询数据库获取真实 userId，确保多用户数据隔离
 * @returns 当前用户的 userId，未登录或用户不存在时返回 null
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await auth()
  if (!session?.user?.email) {
    return null
  }
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
  return user?.id ?? null
}
