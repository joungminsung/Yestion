import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/init";

export const pageRouter = router({
  updateTitle: protectedProcedure
    .input(z.object({ id: z.string(), title: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.page.update({
        where: { id: input.id },
        data: { title: input.title, lastEditedBy: ctx.session.user.id },
      });
    }),
});
