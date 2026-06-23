import { PrismaClient } from "@prisma/client"
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended"

// 创建全局共享的 Prisma mock 实例
// 变量名以 mock 开头，满足 vi.mock hoisting 例外规则
export const mockPrisma: DeepMockProxy<PrismaClient> = mockDeep<PrismaClient>()

export { mockReset }
export type { DeepMockProxy }
