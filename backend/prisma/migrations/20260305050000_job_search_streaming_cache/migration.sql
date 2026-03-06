-- CreateTable
CREATE TABLE "JobSearchRun" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "queryHash" TEXT NOT NULL,
    "countryCode" TEXT,
    "sourceScope" TEXT NOT NULL DEFAULT 'global',
    "status" TEXT NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "lastSequence" INTEGER NOT NULL DEFAULT 0,
    "totalQueued" INTEGER NOT NULL DEFAULT 0,
    "totalReady" INTEGER NOT NULL DEFAULT 0,
    "totalFailed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobSearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobSearchRunEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobSearchRunEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobExtractionCache" (
    "id" TEXT NOT NULL,
    "canonicalUrlHash" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "sourceName" TEXT,
    "sourceDomain" TEXT,
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobExtractionCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobQueryCache" (
    "id" TEXT NOT NULL,
    "queryHash" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "countryCode" TEXT,
    "sourceScope" TEXT NOT NULL DEFAULT 'global',
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobQueryCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobSearchRun_queryHash_startedAt_idx" ON "JobSearchRun"("queryHash", "startedAt");

-- CreateIndex
CREATE INDEX "JobSearchRun_status_startedAt_idx" ON "JobSearchRun"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobSearchRunEvent_runId_sequence_key" ON "JobSearchRunEvent"("runId", "sequence");

-- CreateIndex
CREATE INDEX "JobSearchRunEvent_runId_createdAt_idx" ON "JobSearchRunEvent"("runId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobExtractionCache_canonicalUrlHash_key" ON "JobExtractionCache"("canonicalUrlHash");

-- CreateIndex
CREATE INDEX "JobExtractionCache_expiresAt_idx" ON "JobExtractionCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobQueryCache_queryHash_key" ON "JobQueryCache"("queryHash");

-- CreateIndex
CREATE INDEX "JobQueryCache_expiresAt_idx" ON "JobQueryCache"("expiresAt");

-- AddForeignKey
ALTER TABLE "JobSearchRunEvent" ADD CONSTRAINT "JobSearchRunEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "JobSearchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
