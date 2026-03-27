import { z } from "zod";
import { router, protectedProcedure } from "../trpc/init";

export const mediaRouter = router({
  fetchOgMetadata: protectedProcedure
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }) => {
      const { url } = input;

      try {
        // Dynamic import to avoid bundling server-only module in client
        const ogs = await import("open-graph-scraper");
        const { result } = await ogs.default({ url, timeout: 8000 });

        // Extract favicon from URL
        let favicon = "";
        try {
          const parsed = new URL(url);
          favicon = `${parsed.origin}/favicon.ico`;
        } catch {
          // ignore
        }

        // Override with OG-specified favicon if available
        if (result.favicon) {
          // favicon might be relative
          try {
            favicon = new URL(result.favicon, url).href;
          } catch {
            favicon = result.favicon;
          }
        }

        return {
          title: result.ogTitle || "",
          description: result.ogDescription || "",
          image: result.ogImage?.[0]?.url || "",
          url: result.ogUrl || url,
          siteName: result.ogSiteName || "",
          favicon,
        };
      } catch {
        // Return partial data on error
        let favicon = "";
        try {
          const parsed = new URL(url);
          favicon = `${parsed.origin}/favicon.ico`;
        } catch {
          // ignore
        }

        return {
          title: "",
          description: "",
          image: "",
          url,
          siteName: "",
          favicon,
        };
      }
    }),
});
