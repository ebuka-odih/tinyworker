-- CreateTable
CREATE TABLE "TelegramTask" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "telegramUserId" TEXT,
    "telegramUsername" TEXT,
    "telegramDisplayName" TEXT,
    "messageId" TEXT,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "source" TEXT NOT NULL DEFAULT 'telegram',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "TelegramTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramReport" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sentByUserId" TEXT,
    "telegramMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TelegramTask_chatId_createdAt_idx" ON "TelegramTask"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "TelegramTask_status_createdAt_idx" ON "TelegramTask"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramTask_chatId_messageId_key" ON "TelegramTask"("chatId", "messageId");

-- CreateIndex
CREATE INDEX "TelegramReport_chatId_createdAt_idx" ON "TelegramReport"("chatId", "createdAt");
