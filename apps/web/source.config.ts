import { defineDocs, defineConfig } from "fumadocs-mdx/config";
import { frontmatterSchema, metaSchema } from "fumadocs-mdx/config";
import { z } from "zod";
export const docs: ReturnType<typeof defineDocs> = defineDocs({
  dir: "content/docs",
});

export default defineConfig({});
