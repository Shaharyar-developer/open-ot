import { source } from "@/lib/source";
import { DocsLayout } from "@/components/layout/docs";
import { baseOptions } from "@/lib/layout.shared";
import { RootProvider } from "fumadocs-ui/provider/next";
import "katex/dist/katex.css";
import { FileTerminal, FileTextIcon } from "lucide-react";

export default function Layout({ children }: LayoutProps<"/docs">) {
  return (
    <RootProvider>
      <DocsLayout
        sidebar={{
          tabs: [
            {
              title: "Documentation",
              url: "/docs/introduction",
              icon: (
                <div className="h-full w-full flex items-center justify-center">
                  <FileTextIcon className="size-4.5 text-primary" />
                </div>
              ),
              urls: new Set(
                source
                  .getPages()
                  .map((page) => page.url)
                  .filter((url) => !url.startsWith("/docs/api-reference/"))
              ),
            },
            {
              title: "API Reference",
              url: "/docs/api-reference/core",
              icon: (
                <div className="h-full w-full flex items-center justify-center">
                  <FileTerminal className="size-4.5 text-primary" />
                </div>
              ),
              urls: new Set(
                source
                  .getPages()
                  .map((page) => page.url)
                  .filter((url) => url.startsWith("/docs/api-reference/"))
              ),
            },
          ],
        }}
        tree={source.pageTree}
        {...baseOptions()}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
