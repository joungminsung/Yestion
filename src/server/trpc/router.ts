import { router } from "./init";
import { authRouter } from "@/server/routers/auth";
import { userRouter } from "@/server/routers/user";
import { workspaceRouter } from "@/server/routers/workspace";
import { blockRouter } from "@/server/routers/block";
import { pageRouter } from "@/server/routers/page";
import { databaseRouter } from "@/server/routers/database";
import { mediaRouter } from "@/server/routers/media";
import { shareRouter } from "@/server/routers/share";
import { searchRouter } from "@/server/routers/search";
import { commentRouter } from "@/server/routers/comment";
import { notificationRouter } from "@/server/routers/notification";
import { exportRouter } from "@/server/routers/export";
import { apiKeyRouter } from "@/server/routers/apikey";
import { activityRouter } from "@/server/routers/activity";
import { historyRouter } from "@/server/routers/history";
import { syncedBlockRouter } from "@/server/routers/synced-block";
import { sessionRouter } from "@/server/routers/session";
import { chatRouter } from "@/server/routers/chat";
import { templateRouter } from "@/server/routers/template";
import { webhookRouter } from "@/server/routers/webhook";
import { integrationRouter } from "@/server/routers/integration";
import { roleRouter } from "@/server/routers/role";
import { teamspaceRouter } from "@/server/routers/teamspace";
import { meetingRouter } from "@/server/routers/meeting";
import { channelRouter } from "@/server/routers/channel";

export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  workspace: workspaceRouter,
  block: blockRouter,
  page: pageRouter,
  database: databaseRouter,
  media: mediaRouter,
  share: shareRouter,
  search: searchRouter,
  comment: commentRouter,
  notification: notificationRouter,
  export: exportRouter,
  apiKey: apiKeyRouter,
  activity: activityRouter,
  history: historyRouter,
  syncedBlock: syncedBlockRouter,
  session: sessionRouter,
  chat: chatRouter,
  template: templateRouter,
  webhook: webhookRouter,
  integration: integrationRouter,
  role: roleRouter,
  teamspace: teamspaceRouter,
  meeting: meetingRouter,
  channel: channelRouter,
});

export type AppRouter = typeof appRouter;
