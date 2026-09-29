import type { NextConfig } from "next";
const config: NextConfig = { output: "standalone", serverExternalPackages: ["pdfmake"], outputFileTracingIncludes: { "/api/reports": ["./node_modules/pdfmake/fonts/Roboto/*.ttf"] }, experimental: { proxyClientMaxBodySize: "26mb" } };
export default config;
