ALTER TABLE "JobSearchRun"
ADD COLUMN "userId" TEXT;

CREATE INDEX "JobSearchRun_userId_startedAt_idx" ON "JobSearchRun"("userId", "startedAt");

ALTER TABLE "JobSearchRun"
ADD CONSTRAINT "JobSearchRun_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
