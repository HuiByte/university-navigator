/**
 * 任务相关纯函数
 * 将任务越权校验逻辑从 Route Handler 中剥离，便于单元测试
 */

/**
 * 校验当前用户是否有权操作指定任务
 * 防止水平越权：仅任务归属人本人可操作
 *
 * @param taskUserId 任务的归属用户 ID（任务不存在时为 null）
 * @param currentUserId 当前请求用户 ID
 * @returns 有权操作返回 true，否则 false
 */
export function verifyTaskOwnership(
  taskUserId: string | null,
  currentUserId: string
): boolean {
  // 任务不存在时拒绝操作
  if (taskUserId == null) return false
  // 严格相等比较，防止水平越权
  return taskUserId === currentUserId
}
