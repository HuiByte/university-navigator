/*
 * @Author: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @Date: 2026-06-17 22:46:51
 * @LastEditors: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @LastEditTime: 2026-06-19 11:38:47
 * @FilePath: \AI创作力大赛\university-navigator\src\lib\prisma.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { env } from "@/lib/env"

// 使用全局单例模式管理 Prisma Client 和 pg.Pool，
// 防止开发环境热更新导致数据库连接数爆炸
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pgPool: pg.Pool | undefined
}

function createPrismaClient() {
  // 复用全局缓存的 pg.Pool，避免热更新时反复创建连接池
  const pool = globalForPrisma.pgPool ?? new pg.Pool({
    connectionString: env.DATABASE_URL,
  })
  if (process.env.NODE_ENV !== "production") globalForPrisma.pgPool = pool

  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
