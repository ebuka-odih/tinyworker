-- CreateTable
CREATE TABLE "CandidateIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goal" TEXT,
    "targetRoles" JSONB,
    "targetLocations" JSONB,
    "workModes" JSONB,
    "industries" JSONB,
    "salaryCurrency" TEXT,
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "startTimeline" TEXT,
    "visaRequired" BOOLEAN,
    "constraints" JSONB,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CandidateIntent_userId_createdAt_idx" ON "CandidateIntent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CandidateIntent_status_idx" ON "CandidateIntent"("status");

-- AddForeignKey
ALTER TABLE "CandidateIntent" ADD CONSTRAINT "CandidateIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
