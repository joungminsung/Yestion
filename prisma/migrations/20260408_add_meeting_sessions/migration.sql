ALTER TABLE "Page"
ADD COLUMN "meetingEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "MeetingSession" (
  "id" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "title" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "mode" TEXT NOT NULL DEFAULT 'single_recorder',
  "storeAudio" BOOLEAN NOT NULL DEFAULT false,
  "audioStoragePath" TEXT,
  "lastChunkIndex" INTEGER NOT NULL DEFAULT -1,
  "lastProcessedAt" TIMESTAMP(3),
  "lastNotesGeneratedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MeetingSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingSpeaker" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "displayName" TEXT,
  "source" TEXT NOT NULL DEFAULT 'diarization',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MeetingSpeaker_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingUtterance" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "speakerId" TEXT,
  "speakerLabel" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "startMs" INTEGER NOT NULL,
  "endMs" INTEGER NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "rawJson" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MeetingUtterance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingSnapshot" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "summary" TEXT NOT NULL DEFAULT '',
  "discussion" JSONB NOT NULL DEFAULT '[]',
  "decisions" JSONB NOT NULL DEFAULT '[]',
  "actionItems" JSONB NOT NULL DEFAULT '[]',
  "rawJson" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MeetingSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MeetingSession_pageId_startedAt_idx" ON "MeetingSession"("pageId", "startedAt");
CREATE INDEX "MeetingSession_workspaceId_status_idx" ON "MeetingSession"("workspaceId", "status");
CREATE INDEX "MeetingSpeaker_sessionId_sortOrder_idx" ON "MeetingSpeaker"("sessionId", "sortOrder");
CREATE UNIQUE INDEX "MeetingSpeaker_sessionId_label_key" ON "MeetingSpeaker"("sessionId", "label");
CREATE INDEX "MeetingUtterance_sessionId_chunkIndex_idx" ON "MeetingUtterance"("sessionId", "chunkIndex");
CREATE INDEX "MeetingUtterance_sessionId_startMs_idx" ON "MeetingUtterance"("sessionId", "startMs");
CREATE INDEX "MeetingSnapshot_sessionId_createdAt_idx" ON "MeetingSnapshot"("sessionId", "createdAt");

ALTER TABLE "MeetingSession"
ADD CONSTRAINT "MeetingSession_pageId_fkey"
FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingSession"
ADD CONSTRAINT "MeetingSession_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingSpeaker"
ADD CONSTRAINT "MeetingSpeaker_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "MeetingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingUtterance"
ADD CONSTRAINT "MeetingUtterance_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "MeetingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingUtterance"
ADD CONSTRAINT "MeetingUtterance_speakerId_fkey"
FOREIGN KEY ("speakerId") REFERENCES "MeetingSpeaker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MeetingSnapshot"
ADD CONSTRAINT "MeetingSnapshot_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "MeetingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
