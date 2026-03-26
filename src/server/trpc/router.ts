import { router } from "./init";
import { authRouter } from "@/server/routers/auth";
import { userRouter } from "@/server/routers/user";
import { workspaceRouter } from "@/server/routers/workspace";
import { blockRouter } from "@/server/routers/block";
import { pageRouter } from "@/server/routers/page";
import { databaseRouter } from "@/server/routers/database";

export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  workspace: workspaceRouter,
  block: blockRouter,
  page: pageRouter,
  database: databaseRouter,
});

export type AppRouter = typeof appRouter;
