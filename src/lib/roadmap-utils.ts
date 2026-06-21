/**
 * 路线图相关纯函数
 * 将阶段索引计算逻辑从 Route Handler 中剥离，便于单元测试
 */

/**
 * 根据任务完成进度计算当前所处阶段索引
 * 映射逻辑：n 阶段时 progress 0%→0, 50%→中间, 100%→n-1
 *
 * @param stageCount 阶段总数
 * @param completedCount 已完成任务数
 * @param totalCount 总任务数
 * @returns 当前阶段索引（0-based），无阶段或无任务时返回 0
 */
export function computeCurrentStageIndex(
  stageCount: number,
  completedCount: number,
  totalCount: number
): number {
  // 无阶段或无任务时，进度无法映射，返回第一阶段
  if (stageCount === 0 || totalCount === 0) return 0

  const progress = completedCount / totalCount
  // 将进度等比映射到阶段索引区间 [0, stageCount-1]
  return Math.min(
    Math.floor(progress * (stageCount - 1)),
    stageCount - 1
  )
}
