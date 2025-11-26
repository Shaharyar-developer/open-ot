import { createMDX } from "fumadocs-mdx/next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@open-ot/ui"],
  reactStrictMode: true,
  serverExternalPackages: ["typescript", "twoslash"],
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
