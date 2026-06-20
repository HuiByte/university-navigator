/*
 * @Author: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @Date: 2026-06-18 16:11:44
 * @LastEditors: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @LastEditTime: 2026-06-19 12:02:11
 * @FilePath: \AI创作力大赛\university-navigator\src\auth.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { authConfig } from "./auth.config"
import { prisma } from "@/lib/prisma"

// Auth.js v5 配置
// 在 authConfig 基础上扩展 PrismaAdapter，将用户和账户数据持久化到数据库
// GitHub 作为 OAuth Provider，环境变量前缀为 AUTH_
// 使用 JWT 会话策略：middleware 运行在 Edge Runtime，无法访问数据库，
// 改用 JWT 后会话信息存储在 Cookie 中，middleware 可直接读取以判断登录状态
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
})
