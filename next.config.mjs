import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  // Webpack cache stability fix
  webpack: (config, { dev }) => {
    if (dev) {
      // Snapshot immutable paths to prevent unnecessary cache invalidation
      config.snapshot = {
        ...config.snapshot,
        managedPaths: [/^(.+?[\\/]node_modules[\\/])/],
      };

      // Suppress next-intl dynamic import parsing warning that causes cache churn
      config.module.rules.push({
        test: /next-intl.*extractor.*format.*index\.js$/,
        resolve: { fullySpecified: false },
      });
    }
    return config;
  },

  // Reduce unnecessary recompilation
  experimental: {
    // Faster refresh with optimized compilation
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "@tiptap/core",
      "@tiptap/react",
      "@tiptap/starter-kit",
    ],
  },
};

export default withNextIntl(nextConfig);
