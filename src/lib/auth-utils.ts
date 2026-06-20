/*
 * @Author: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @Date: 2026-06-19 10:14:18
 * @LastEditors: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @LastEditTime: 2026-06-19 10:14:37
 * @FilePath: \AI创作力大赛\university-navigator\src\lib\auth-utils.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
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
