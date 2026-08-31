/** @type {import('next').NextConfig} */
const nextConfig = {
  // Full-stack Next.js deployed to Vercel; static export removed so API
  // routes and Server Actions can run on the server.
  trailingSlash: true,
  // Allow sandbox preview proxy (127.0.0.1) to access HMR/dev resources.
  allowedDevOrigins: ["127.0.0.1"],
  // Import .md files as raw strings (agent setup guides under app/agent/*).
  turbopack: {
    rules: {
      "*.md": { loaders: ["raw-loader"], as: "*.js" },
    },
  },
  webpack: (config) => {
    config.module.rules.push({ test: /\.md$/, type: "asset/source" });
    return config;
  },
};

export default nextConfig;
