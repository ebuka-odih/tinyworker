-- CreateTable
CREATE TABLE "CV" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "storagePath" TEXT NOT NULL,
    "extractedText" TEXT,
    "keywords" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CV_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cvId" TEXT,
    "name" TEXT,
    "titleHeadline" TEXT,
    "seniorityGuess" TEXT,
    "yearsExperienceGuess" DOUBLE PRECISION,
    "roles" JSONB,
    "skills" JSONB,
    "toolsStack" JSONB,
    "industries" JSONB,
    "achievements" JSONB,
    "education" JSONB,
    "certifications" JSONB,
    "keywords" JSONB,
    "preferredRoles" JSONB,
    "preferredLocations" JSONB,
    "links" JSONB,
    "redFlags" JSONB,
    "source" TEXT NOT NULL DEFAULT 'cv',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CV_userId_createdAt_idx" ON "CV"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CandidateProfile_userId_createdAt_idx" ON "CandidateProfile"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CandidateProfile_status_idx" ON "CandidateProfile"("status");

-- AddForeignKey
ALTER TABLE "CV" ADD CONSTRAINT "CV_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
