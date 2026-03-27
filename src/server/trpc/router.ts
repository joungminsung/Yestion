import { router } from "./init";
import { authRouter } from "@/server/routers/auth";
import { userRouter } from "@/server/routers/user";
import { workspaceRouter } from "@/server/routers/workspace";
import { blockRouter } from "@/server/routers/block";
import { pageRouter } from "@/server/routers/page";
import { databaseRouter } from "@/server/routers/database";
import { mediaRouter } from "@/server/routers/media";
import { shareRouter } from "@/server/routers/share";

export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  workspace: workspaceRouter,
  block: blockRouter,
  page: pageRouter,
  database: databaseRouter,
  media: mediaRouter,
  share: shareRouter,
});

export type AppRouter = typeof appRouter;
