import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "@remotion/bundler", "@remotion/renderer", "@remotion/cli"],
};

export default nextConfig;
