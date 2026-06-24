/**
 * 统一 API 响应格式定义
 * 所有 API 路由的 error / success 响应均通过此模块构造，保证前端可按固定结构解析错误
 */

/** 业务错误码，前端据此决定提示方式与重试策略 */
export type ApiErrorCode =
  | "RATE_LIMIT_EXCEEDED"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "AI_GENERATION_FAILED"
  | "ALREADY_CHECKED_IN"
  | "AI_TIMEOUT"
  | "INTERNAL_ERROR"

/** 统一错误响应结构 */
export interface ApiErrorResponse {
  success: false
  error: {
    code: ApiErrorCode
    message: string
    /** 字段级校验错误，仅校验类错误返回 */
    fieldErrors?: Record<string, string[] | undefined>
  }
}

/** 统一成功响应结构 */
export interface ApiSuccessResponse<T = unknown> {
  success: true
  data: T
}

/** 错误码 → HTTP 状态码映射 */
const ERROR_STATUS_MAP: Record<ApiErrorCode, number> = {
  RATE_LIMIT_EXCEEDED: 429,
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  AI_GENERATION_FAILED: 502,
  ALREADY_CHECKED_IN: 409,
  AI_TIMEOUT: 504,
  INTERNAL_ERROR: 500,
}

/**
 * 构造统一错误响应
 * @param code 业务错误码
 * @param message 面向用户的错误描述
 * @param init 额外 Response 初始化项（如 headers）
 * @param fieldErrors 字段级校验错误（仅校验类错误返回）
 */
export function errorResponse(
  code: ApiErrorCode,
  message: string,
  init?: ResponseInit,
  fieldErrors?: Record<string, string[] | undefined>
): Response {
  const body: ApiErrorResponse = {
    success: false,
    error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) },
  }
  return Response.json(body, {
    status: ERROR_STATUS_MAP[code],
    ...init,
  })
}

/**
 * 构造统一成功响应
 * @param data 业务数据
 * @param init 额外 Response 初始化项（如 status / headers）
 */
export function successResponse<T>(
  data: T,
  init?: ResponseInit
): Response {
  const body: ApiSuccessResponse<T> = { success: true, data }
  return Response.json(body, init)
}
