"use client";

import { Suspense, use, useEffect, useId, useState } from "react";
import { useTheme } from "next-themes";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@open-ot/ui/components/dialog";
import { Skeleton } from "@open-ot/ui/components/skeleton";

export function Mermaid({ chart }: { chart: string }) {
  return (
    <Suspense fallback={<Skeleton className="h-72 w-full rounded-lg" />}>
      <MermaidRaw chart={chart} />
    </Suspense>
  );
}

function MermaidRaw({ chart }: { chart: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return;
  return <MermaidContent chart={chart} />;
}

const cache = new Map<string, Promise<unknown>>();

function cachePromise<T>(
  key: string,
  setPromise: () => Promise<T>
): Promise<T> {
  const cached = cache.get(key);
  if (cached) return cached as Promise<T>;

  const promise = setPromise();
  cache.set(key, promise);
  return promise;
}

function MermaidContent({ chart }: { chart: string }) {
  const id = useId();
  const previewId = `mermaid-${id.replace(/:/g, "")}`;
  const modalId = `${previewId}-modal`;
  const { resolvedTheme } = useTheme();
  const { default: mermaid } = use(
    cachePromise("mermaid", () => import("mermaid"))
  );

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    fontFamily: "inherit",
    themeCSS: "margin: 1.5rem auto 0;",
    theme: resolvedTheme === "dark" ? "dark" : "default",
  });

  const { svg: previewSvg, bindFunctions: bindPreview } = use(
    cachePromise(`${chart}-${resolvedTheme}-${previewId}`, () => {
      return mermaid.render(previewId, chart.replaceAll("\\n", "\n"));
    })
  );

  const { svg: modalSvg, bindFunctions: bindModal } = use(
    cachePromise(`${chart}-${resolvedTheme}-${modalId}`, () => {
      return mermaid.render(modalId, chart.replaceAll("\\n", "\n"));
    })
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div
          className="cursor-pointer hover:bg-muted/50 transition-colors rounded-lg p-2"
          ref={(container) => {
            if (container) bindPreview?.(container);
          }}
          dangerouslySetInnerHTML={{ __html: previewSvg }}
          title="Click to zoom"
        />
      </DialogTrigger>
      <DialogContent className="max-w-[90svw]! w-full overflow-auto max-h-[90vh]">
        <DialogTitle className="sr-only">Zoomed Diagram</DialogTitle>
        <div
          className="flex justify-center"
          ref={(container) => {
            if (container) bindModal?.(container);
          }}
          dangerouslySetInnerHTML={{ __html: modalSvg }}
        />
      </DialogContent>
    </Dialog>
  );
}
