import { source } from "@/lib/source";
import { DocsLayout } from "@/components/layout/docs";
import { baseOptions } from "@/lib/layout.shared";
import { RootProvider } from "fumadocs-ui/provider/next";
import "katex/dist/katex.css";

export default function Layout({ children }: LayoutProps<"/docs">) {
  return (
    <RootProvider>
      <DocsLayout tree={source.pageTree} {...baseOptions()}>
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
