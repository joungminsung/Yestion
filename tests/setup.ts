import "@testing-library/jest-dom/vitest";
import { beforeAll } from "vitest";

// Clean database before all tests to remove stale data
// Order: delete dependent tables first to avoid FK constraint violations
beforeAll(async () => {
  try {
    const { db } = await import("@/server/db/client");
    // Clean in dependency order (leaves → roots)
    await db.webhookDelivery.deleteMany();
    await db.commentReaction.deleteMany();
    await db.meetingChunkReceipt.deleteMany();
    await db.meetingParticipant.deleteMany();
    await db.meetingSnapshot.deleteMany();
    await db.meetingUtterance.deleteMany();
    await db.meetingSpeaker.deleteMany();
    await db.meetingSession.deleteMany();
    await db.workspaceChannelAuditLog.deleteMany();
    await db.workspaceChannelReadState.deleteMany();
    await db.workspaceChannelBrowserTab.deleteMany();
    await db.workspaceChannelBrowserSession.deleteMany();
    await db.workspaceChannelVoicePresence.deleteMany();
    await db.workspaceChannelMessage.deleteMany();
    await db.workspaceChannel.deleteMany();
    await db.chatMessage.deleteMany();
    await db.notification.deleteMany();
    await db.activityLog.deleteMany();
    await db.pageSnapshot.deleteMany();
    await db.syncedBlock.deleteMany();
    await db.pagePermission.deleteMany();
    await db.comment.deleteMany();
    await db.block.deleteMany();
    await db.favorite.deleteMany();
    await db.rowTemplate.deleteMany();
    await db.row.deleteMany();
    await db.databaseView.deleteMany();
    await db.property.deleteMany();
    await db.database.deleteMany();
    await db.session.deleteMany();
    await db.webhook.deleteMany();
    await db.apiKey.deleteMany();
    await db.teamspaceMember.deleteMany();
    await db.teamspace.deleteMany();
    await db.template.deleteMany();
    await db.integration.deleteMany();
    await db.customRole.deleteMany();
    await db.page.deleteMany();
    await db.workspaceMember.deleteMany();
    await db.workspace.deleteMany();
    await db.user.deleteMany();
  } catch {
    // Ignore if db not available (e.g., component tests)
  }
});
