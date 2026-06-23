import { NextRequest } from "next/server"

/**
 * 构造 NextRequest，用于测试 API 路由处理函数
 * @param path 请求路径（如 "/api/tasks"）
 * @param init 请求配置
 */
export function makeRequest(
  path: string,
  init: {
    method?: string
    body?: unknown
    headers?: Record<string, string>
  } = {}
): NextRequest {
  const { method = "GET", body, headers = {} } = init
  const reqInit: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  }
  if (body !== undefined) {
    reqInit.body = JSON.stringify(body)
  }
  return new NextRequest(new URL(path, "http://localhost:3000"), reqInit)
}

/**
 * 构造动态路由的 context 参数
 * Next.js 15+ 中 params 是 Promise，需包装为 Promise.resolve
 */
export function makeContext(params: Record<string, string> = {}) {
  return { params: Promise.resolve(params) }
}
