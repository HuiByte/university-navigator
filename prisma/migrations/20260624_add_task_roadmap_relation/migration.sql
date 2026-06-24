-- 为 DailyTask 增加路线图关联字段
-- roadmapId: 关联来源路线图（可选，手动创建的任务为 NULL）
-- stageIndex: 来源阶段索引（可选，用于追溯任务属于哪个阶段）
-- onDelete: SetNull —— 路线图被删除时，关联任务的 roadmapId 置 NULL，任务本身保留

ALTER TABLE "DailyTask" ADD COLUMN "roadmapId" TEXT;
ALTER TABLE "DailyTask" ADD COLUMN "stageIndex" INTEGER;

-- 创建索引加速按路线图查询任务（如清理旧任务）
CREATE INDEX "DailyTask_roadmapId_idx" ON "DailyTask"("roadmapId");

-- 添加外键约束：roadmapId 引用 Roadmap.id，删除路线图时置 NULL
ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE SET NULL ON UPDATE CASCADE;
