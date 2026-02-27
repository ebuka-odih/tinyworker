/*
  Warnings:

  - A unique constraint covering the columns `[accessToken]` on the table `CV` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `accessToken` to the `CV` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- Add as nullable first (table may already have rows)
ALTER TABLE "CV" ADD COLUMN     "accessToken" TEXT;

-- Backfill existing rows
UPDATE "CV" SET "accessToken" = md5(random()::text || clock_timestamp()::text) WHERE "accessToken" IS NULL;

-- Enforce non-null
ALTER TABLE "CV" ALTER COLUMN "accessToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CV_accessToken_key" ON "CV"("accessToken");
