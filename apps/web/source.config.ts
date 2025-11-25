import { defineDocs, defineConfig } from "fumadocs-mdx/config";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

export const docs: ReturnType<typeof defineDocs> = defineDocs({
  dir: "content/docs",
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkMath],
    // Place it at first, it should be executed before the syntax highlighter
    rehypePlugins: (v) => [rehypeKatex, ...v],
  },
});
