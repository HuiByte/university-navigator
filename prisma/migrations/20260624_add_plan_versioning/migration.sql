-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable: Plan 新增版本控制字段
ALTER TABLE "Plan" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Plan" ADD COLUMN     "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Plan" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex: Plan 查询索引
CREATE INDEX "Plan_userId_status_idx" ON "Plan"("userId", "status");
CREATE INDEX "Plan_userId_version_idx" ON "Plan"("userId", "version");

-- AlterTable: Roadmap 去掉 @unique 约束，新增版本控制字段
DROP INDEX IF EXISTS "Roadmap_planId_key";
ALTER TABLE "Roadmap" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Roadmap" ADD COLUMN     "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Roadmap" ADD COLUMN     "archivedAt" TIMESTAMP(3);
ALTER TABLE "Roadmap" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex: Roadmap 改为普通索引（原为唯一约束）
CREATE INDEX "Roadmap_planId_idx" ON "Roadmap"("planId");