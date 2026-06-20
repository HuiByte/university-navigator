/*
 * @Author: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @Date: 2026-06-19 12:01:57
 * @LastEditors: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @LastEditTime: 2026-06-19 12:02:00
 * @FilePath: \AI创作力大赛\university-navigator\src\auth.config.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import GitHub from "next-auth/providers/github"
import type { NextAuthConfig } from "next-auth"

/**
 * Auth.js 基础配置（Edge Runtime 安全）
 * 仅包含 providers 和 session 策略，不导入 Prisma 等 Node.js 原生模块依赖。
 * 供 middleware.ts 在 Edge Runtime 中使用，避免 node:util/types 等原生模块报错。
 */
export const authConfig = {
  providers: [GitHub],
  session: { strategy: "jwt" },
} satisfies NextAuthConfig
