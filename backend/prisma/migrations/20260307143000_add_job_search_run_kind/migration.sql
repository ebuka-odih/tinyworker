ALTER TABLE "JobSearchRun"
ADD COLUMN "runKind" TEXT NOT NULL DEFAULT 'job';

CREATE INDEX "JobSearchRun_userId_runKind_idx"
ON "JobSearchRun"("userId", "runKind");

UPDATE "JobSearchRun" AS run
SET "runKind" = CASE
  WHEN EXISTS (
    SELECT 1
    FROM "JobSearchRunEvent" AS event
    WHERE event."runId" = run."id"
      AND (
        COALESCE(event."payload"->>'type', '') = 'visa'
        OR COALESCE(event."payload"->'result'->>'opportunityType', '') = 'visa'
      )
  ) THEN 'visa'
  WHEN EXISTS (
    SELECT 1
    FROM "JobSearchRunEvent" AS event
    WHERE event."runId" = run."id"
      AND (
        COALESCE(event."payload"->>'type', '') = 'scholarship'
        OR COALESCE(event."payload"->'result'->>'opportunityType', '') = 'scholarship'
      )
  ) THEN 'scholarship'
  ELSE 'job'
END;
