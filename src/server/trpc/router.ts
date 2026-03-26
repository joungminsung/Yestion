import { router } from "./init";
import { authRouter } from "@/server/routers/auth";
import { userRouter } from "@/server/routers/user";
import { workspaceRouter } from "@/server/routers/workspace";
import { blockRouter } from "@/server/routers/block";

export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  workspace: workspaceRouter,
  block: blockRouter,
});

export type AppRouter = typeof appRouter;
