-- CreateTable
CREATE TABLE "WorkspaceChannelBrowserSession" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "controllerUserId" TEXT NOT NULL,
    "requestedControllerUserId" TEXT,
    "activeUrl" TEXT,
    "activeTitle" TEXT,
    "activeDomain" TEXT,
    "lastNavigatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastControlRequestedAt" TIMESTAMP(3),
    "lastControlGrantedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceChannelBrowserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceChannelBrowserTab" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceChannelBrowserTab_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceChannelBrowserSession_channelId_key" ON "WorkspaceChannelBrowserSession"("channelId");

-- CreateIndex
CREATE INDEX "WorkspaceChannelBrowserSession_controllerUserId_idx" ON "WorkspaceChannelBrowserSession"("controllerUserId");

-- CreateIndex
CREATE INDEX "WorkspaceChannelBrowserTab_sessionId_position_idx" ON "WorkspaceChannelBrowserTab"("sessionId", "position");

-- AddForeignKey
ALTER TABLE "WorkspaceChannelBrowserSession" ADD CONSTRAINT "WorkspaceChannelBrowserSession_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "WorkspaceChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceChannelBrowserTab" ADD CONSTRAINT "WorkspaceChannelBrowserTab_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkspaceChannelBrowserSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
