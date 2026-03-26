import { router } from "./init";
import { authRouter } from "@/server/routers/auth";
import { userRouter } from "@/server/routers/user";
import { workspaceRouter } from "@/server/routers/workspace";

export const appRouter = router({
  auth: authRouter,
  user: userRouter,
  workspace: workspaceRouter,
});

export type AppRouter = typeof appRouter;
