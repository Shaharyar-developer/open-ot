import { createMDX } from "fumadocs-mdx/next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@open-ot/ui"],
  reactStrictMode: true,
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
