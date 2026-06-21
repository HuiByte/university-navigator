/**
 * 前端统一 API 请求工具
 * 自动解析后端 ApiErrorResponse / ApiSuccessResponse，错误时抛出 ApiError 并可选 toast 提示
 */

import { toast } from "sonner"
import type {
  ApiErrorResponse,
  ApiSuccessResponse,
  ApiErrorCode,
} from "./api-response"

/** 业务异常，携带错误码与 HTTP 状态码 */
export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number

  constructor(code: ApiErrorCode, message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.code = code
    this.status = status
  }
}

interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  /** 请求体，自动 JSON.stringify */
  body?: unknown
  /** 是否自动 toast 错误提示，默认 true。页面级加载失败可设 false 改用内联展示 */
  showToast?: boolean
}

/**
 * 发起 JSON API 请求，返回 ApiSuccessResponse.data
 *
 * - 成功：返回 data 字段（类型 T）
 * - 失败：抛出 ApiError，默认自动 toast.error 提示
 *
 * @example
 * const plan = await apiFetch<string>("/api/generate-plan", { method: "POST", body: formData })
 */
export async function apiFetch<T>(
  url: string,
  options?: ApiFetchOptions
): Promise<T> {
  const { body, showToast = true, headers, ...rest } = options ?? {}

  let res: Response
  try {
    res = await fetch(url, {
      ...rest,
      headers: body !== undefined ? { "Content-Type": "application/json", ...headers } : headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    const message = "网络请求失败，请检查网络连接"
    if (showToast) toast.error(message)
    throw new ApiError("INTERNAL_ERROR", message, 0)
  }

  const contentType = res.headers.get("content-type") ?? ""

  // 流式响应（chat / ai-summary）：非 JSON 时直接返回 Response，由调用方处理流
  if (!contentType.includes("application/json")) {
    if (!res.ok) {
      const message = "请求失败，请稍后重试"
      if (showToast) toast.error(message)
      throw new ApiError("INTERNAL_ERROR", message, res.status)
    }
    return res as unknown as T
  }

  const json: unknown = await res.json()

  if (!res.ok) {
    const err = json as ApiErrorResponse
    const message = err?.error?.message ?? "请求失败，请稍后重试"
    const code = err?.error?.code ?? "INTERNAL_ERROR"
    if (showToast) toast.error(message)
    throw new ApiError(code, message, res.status)
  }

  // 统一成功格式：{ success: true, data: T }
  if (
    json &&
    typeof json === "object" &&
    "success" in json &&
    (json as ApiSuccessResponse).success === true
  ) {
    return (json as ApiSuccessResponse<T>).data
  }

  // 兜底：直接返回（过渡期兼容非标准响应）
  return json as T
}
