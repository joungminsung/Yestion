import { router, publicProcedure } from "@/server/trpc/init";

export const authRouter = router({
  health: publicProcedure.query(() => {
    return { status: "ok" };
  }),
});
