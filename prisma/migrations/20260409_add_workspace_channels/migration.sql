-- CreateTable
CREATE TABLE "WorkspaceChannel" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "teamspaceId" TEXT,
    "createdBy" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "type" TEXT NOT NULL DEFAULT 'text',
    "topic" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceChannelMessage" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceChannelMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceChannelVoicePresence" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceChannelVoicePresence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceChannel_workspaceId_slug_key" ON "WorkspaceChannel"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "WorkspaceChannel_workspaceId_teamspaceId_type_position_idx" ON "WorkspaceChannel"("workspaceId", "teamspaceId", "type", "position");

-- CreateIndex
CREATE INDEX "WorkspaceChannelMessage_channelId_createdAt_idx" ON "WorkspaceChannelMessage"("channelId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceChannelMessage_userId_idx" ON "WorkspaceChannelMessage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceChannelVoicePresence_channelId_userId_key" ON "WorkspaceChannelVoicePresence"("channelId", "userId");

-- CreateIndex
CREATE INDEX "WorkspaceChannelVoicePresence_channelId_status_joinedAt_idx" ON "WorkspaceChannelVoicePresence"("channelId", "status", "joinedAt");

-- AddForeignKey
ALTER TABLE "WorkspaceChannel" ADD CONSTRAINT "WorkspaceChannel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceChannel" ADD CONSTRAINT "WorkspaceChannel_teamspaceId_fkey" FOREIGN KEY ("teamspaceId") REFERENCES "Teamspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceChannelMessage" ADD CONSTRAINT "WorkspaceChannelMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "WorkspaceChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceChannelMessage" ADD CONSTRAINT "WorkspaceChannelMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceChannelVoicePresence" ADD CONSTRAINT "WorkspaceChannelVoicePresence_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "WorkspaceChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceChannelVoicePresence" ADD CONSTRAINT "WorkspaceChannelVoicePresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
