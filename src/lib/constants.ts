/**
 * 学历选项常量（单源管理）
 * 前端下拉框、Zod 校验、类型定义均引用此常量
 * 新增学历类型只需在此处追加，全链路自动生效
 */
export const DEGREE_OPTIONS = ["专科", "本科", "硕士", "博士"] as const

/** 学历类型：从 DEGREE_OPTIONS 推导出的联合类型 */
export type DegreeType = (typeof DEGREE_OPTIONS)[number]
