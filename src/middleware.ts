import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"
import { NextResponse } from "next/server"

// 受保护的核心页面路径
// 未登录用户访问这些路径时会被重定向到登录页
const protectedPaths = ["/plan", "/roadmap", "/tasks", "/progress"]

/**
 * Auth.js v5 中间件
 * 通过 auth 函数包装，req.auth 包含当前会话信息（JWT 策略下从 Cookie 读取）
 * 对受保护路径进行登录校验，未登录时重定向到 /api/auth/signin
 *
 * 注意：此处从 authConfig（Edge Runtime 安全）创建 auth 实例，
 * 不导入 @/auth 以避免 Prisma 等 Node.js 原生模块被打包进 Edge Runtime。
 */
const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  // 判断当前路径是否属于受保护路由
  const isProtected = protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  )

  // 访问受保护页面但未登录 → 重定向到登录页，并携带 callbackUrl 以便登录后跳回
  if (isProtected && !isLoggedIn) {
    const signInUrl = new URL("/api/auth/signin", req.nextUrl.origin)
    signInUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
})

// 匹配器：排除 API 路由、静态资源、图片等，其余路径均经过中间件
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
