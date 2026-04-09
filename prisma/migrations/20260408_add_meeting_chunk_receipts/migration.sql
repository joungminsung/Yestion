CREATE TABLE "MeetingChunkReceipt" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "chunkStartedAtMs" INTEGER NOT NULL,
  "chunkEndedAtMs" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'processing',
  "error" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MeetingChunkReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MeetingChunkReceipt_sessionId_sourceKey_chunkIndex_key"
ON "MeetingChunkReceipt"("sessionId", "sourceKey", "chunkIndex");

CREATE INDEX "MeetingChunkReceipt_sessionId_createdAt_idx"
ON "MeetingChunkReceipt"("sessionId", "createdAt");

CREATE INDEX "MeetingChunkReceipt_sessionId_sourceKey_chunkIndex_idx"
ON "MeetingChunkReceipt"("sessionId", "sourceKey", "chunkIndex");

ALTER TABLE "MeetingChunkReceipt"
ADD CONSTRAINT "MeetingChunkReceipt_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "MeetingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
