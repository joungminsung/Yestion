-- CreateTable
CREATE TABLE "WorkspaceChannelReadState" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadMessageId" TEXT,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceChannelReadState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceChannelAuditLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceChannelAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceChannelReadState_channelId_userId_key" ON "WorkspaceChannelReadState"("channelId", "userId");

-- CreateIndex
CREATE INDEX "WorkspaceChannelReadState_userId_lastReadAt_idx" ON "WorkspaceChannelReadState"("userId", "lastReadAt");

-- CreateIndex
CREATE INDEX "WorkspaceChannelAuditLog_workspaceId_createdAt_idx" ON "WorkspaceChannelAuditLog"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceChannelAuditLog_channelId_createdAt_idx" ON "WorkspaceChannelAuditLog"("channelId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceChannelAuditLog_userId_createdAt_idx" ON "WorkspaceChannelAuditLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkspaceChannelReadState" ADD CONSTRAINT "WorkspaceChannelReadState_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "WorkspaceChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceChannelReadState" ADD CONSTRAINT "WorkspaceChannelReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceChannelAuditLog" ADD CONSTRAINT "WorkspaceChannelAuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceChannelAuditLog" ADD CONSTRAINT "WorkspaceChannelAuditLog_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "WorkspaceChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceChannelAuditLog" ADD CONSTRAINT "WorkspaceChannelAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
