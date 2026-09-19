import type { NextConfig } from "next";
const config: NextConfig = { output: "standalone", experimental: { proxyClientMaxBodySize: "26mb" } };
export default config;
