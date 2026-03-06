ALTER TABLE "JobSearchRun"
ADD COLUMN "intentHash" TEXT;

CREATE INDEX "JobSearchRun_intentHash_startedAt_idx" ON "JobSearchRun"("intentHash", "startedAt");

ALTER TABLE "JobQueryCache"
ADD COLUMN "intentHash" TEXT,
ADD COLUMN "normalizedIntent" TEXT,
ADD COLUMN "remote" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "visaSponsorship" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "resultCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "JobQueryCache_intentHash_expiresAt_idx" ON "JobQueryCache"("intentHash", "expiresAt");
