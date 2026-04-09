import createNextIntlPlugin from "next-intl/plugin";
import withPWAInit from "next-pwa";

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: "NetworkFirst",
      options: {
        cacheName: "offlineCache",
        expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
  ],
});

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
    // Keep native Node.js packages out of the webpack bundle
    serverComponentsExternalPackages: ["ws"],
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

export default withPWA(withNextIntl(nextConfig));
