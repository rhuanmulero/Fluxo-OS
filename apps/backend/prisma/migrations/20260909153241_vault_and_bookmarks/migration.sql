-- CreateEnum
CREATE TYPE "KnowledgeScope" AS ENUM ('PRIVATE', 'PROJECT', 'WORKSPACE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProjectModuleName" ADD VALUE 'VAULT';
ALTER TYPE "ProjectModuleName" ADD VALUE 'BOOKMARKS';

-- CreateTable
CREATE TABLE "document" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "project_id" TEXT,
    "author_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "scope" "KnowledgeScope" NOT NULL DEFAULT 'PRIVATE',
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmark" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "project_id" TEXT,
    "author_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "scope" "KnowledgeScope" NOT NULL DEFAULT 'PRIVATE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_storage_key_key" ON "document"("storage_key");

-- CreateIndex
CREATE INDEX "document_workspace_id_scope_idx" ON "document"("workspace_id", "scope");

-- CreateIndex
CREATE INDEX "document_workspace_id_folder_idx" ON "document"("workspace_id", "folder");

-- CreateIndex
CREATE INDEX "bookmark_workspace_id_scope_idx" ON "bookmark"("workspace_id", "scope");

-- CreateIndex
CREATE INDEX "bookmark_workspace_id_folder_idx" ON "bookmark"("workspace_id", "folder");

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmark" ADD CONSTRAINT "bookmark_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmark" ADD CONSTRAINT "bookmark_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmark" ADD CONSTRAINT "bookmark_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
