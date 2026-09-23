-- CreateEnum
CREATE TYPE "RoadmapStageStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DONE');

-- AlterEnum
ALTER TYPE "ProjectModuleName" ADD VALUE 'ROADMAP';

-- CreateTable
CREATE TABLE "roadmap" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roadmap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_stage" (
    "id" TEXT NOT NULL,
    "roadmap_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "goal" TEXT,
    "points" INTEGER NOT NULL DEFAULT 1,
    "status" "RoadmapStageStatus" NOT NULL DEFAULT 'PLANNED',
    "position" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roadmap_stage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "roadmap_project_id_idx" ON "roadmap"("project_id");

-- CreateIndex
CREATE INDEX "roadmap_stage_roadmap_id_position_idx" ON "roadmap_stage"("roadmap_id", "position");

-- AddForeignKey
ALTER TABLE "roadmap" ADD CONSTRAINT "roadmap_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap" ADD CONSTRAINT "roadmap_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_stage" ADD CONSTRAINT "roadmap_stage_roadmap_id_fkey" FOREIGN KEY ("roadmap_id") REFERENCES "roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
