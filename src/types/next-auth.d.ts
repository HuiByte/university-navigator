/*
 * @Author: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @Date: 2026-06-21 16:05:36
 * @LastEditors: error: error: git config user.name & please set dead value or install git && error: git config user.email & please set dead value or install git & please set dead value or install git
 * @LastEditTime: 2026-06-21 16:05:39
 * @FilePath: \AI创作力大赛\university-navigator\src\types\next-auth.d.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
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
