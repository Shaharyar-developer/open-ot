"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Github } from "lucide-react";
import { Button } from "@open-ot/ui/components/button";
import { TextType, type TextOperation } from "@open-ot/core";
import { GravityStarsBackground } from "@open-ot/ui/animated/gravity-stars";
import Link from "next/link";

const demoSequence = [
  "Hello World",
  "Hello OpenOT World",
  "Hello OpenOT",
  "Hello Collaborative OpenOT",
  "Collaborative OpenOT",
  "Type-safe Collaborative OpenOT",
];

export function Hero() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [document, setDocument] = useState(demoSequence[0]);
  const [operations, setOperations] = useState<string[]>([]);

  // Auto-cycle through demo sequence
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const nextIndex = (prev + 1) % demoSequence.length;
        const nextText = demoSequence[nextIndex]!;
        const currentText = demoSequence[prev]!;

        // Generate and apply operation
        const op = generateSimpleOp(currentText, nextText);
        if (op.length > 0) {
          const newDoc = TextType.apply(currentText, op);
          setDocument(newDoc);
          setOperations((prevOps) =>
            [...prevOps, formatOperation(op)].slice(-5)
          );
        }

        return nextIndex;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className=" relative overflow-hidden">
      {/* Animated gradient circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-[-20%] right-[-10%] w-[40%] h-[60%] bg-primary/5 rounded-full blur-3xl animate-float"
          style={{ animationDuration: "8s" }}
        />
        <div
          className="absolute bottom-[-20%] left-[-10%] w-[35%] h-[50%] bg-accent/5 rounded-full blur-3xl animate-float"
          style={{ animationDuration: "10s", animationDelay: "2s" }}
        />
      </div>

      <div className="container px-6 py-24 md:py-32 mx-auto max-w-7xl relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Text Content */}
          <div className="space-y-8 animate-slide-in-left relative">
            <div className="absolute h-[110%] w-[110%] -z-10">
              <GravityStarsBackground />
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight pointer-events-none">
              <span
                className="block animate-fade-in-up"
                style={{ animationDelay: "0.1s" }}
              >
                Type-Agnostic
              </span>
              <span
                className="block text-primary animate-fade-in-up"
                style={{ animationDelay: "0.2s" }}
              >
                Operational
              </span>
              <span
                className="block text-primary animate-fade-in-up"
                style={{ animationDelay: "0.3s" }}
              >
                Transformation
              </span>
            </h1>

            <p
              className="text-lg md:text-xl text-muted-foreground leading-relaxed animate-fade-in-up"
              style={{ animationDelay: "0.4s" }}
            >
              The OT engine that doesn&apos;t assume your deployment. Bring your
              own backend, network, and data structure.
            </p>

            <div
              className="flex flex-col sm:flex-row gap-3 animate-fade-in-up"
              style={{ animationDelay: "0.5s" }}
            >
              <Button
                asChild
                size="lg"
                className="group shadow-lg hover:shadow-xl transition-all hover:scale-105"
              >
                <Link
                  href="/docs/introduction"
                  className="flex items-center gap-2"
                >
                  Get Started
                  <span className="group-hover:translate-x-0.5 transition-transform">
                    <ArrowRight />
                  </span>
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="hover:scale-105 transition-transform"
              >
                <a
                  href="https://github.com/Shaharyar-developer/open-ot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <Github className="w-4 h-4" />
                  GitHub
                </a>
              </Button>
            </div>

            {/* Key highlights */}
            <div
              className="grid grid-cols-3 gap-4 pt-4 animate-fade-in-up"
              style={{ animationDelay: "0.6s" }}
            >
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">100%</div>
                <div className="text-xs text-muted-foreground">Type-Safe</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">1</div>
                <div className="text-xs text-muted-foreground">
                  Dependencies
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">MIT</div>
                <div className="text-xs text-muted-foreground">Licensed</div>
              </div>
            </div>
          </div>

          {/* Right: Animated Demo */}
          <div className="relative animate-slide-in-right">
            <div className="glass rounded-2xl p-6 shadow-2xl border-2 border-primary/10">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-destructive/80" />
                  <div className="w-3 h-3 rounded-full bg-chart-4/80" />
                  <div className="w-3 h-3 rounded-full bg-chart-2/80" />
                </div>
                <span className="text-xs text-muted-foreground ml-auto">
                  Auto Demo
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">
                    Document
                  </label>
                  <textarea
                    value={document}
                    readOnly
                    className="w-full h-24 p-3 rounded-lg border border-primary/20 bg-background/50 font-mono text-sm resize-none cursor-default"
                    placeholder="Watch the demo..."
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">
                    Operations Stream
                  </label>
                  <div className="h-32 p-3 rounded-lg border border-border/50 bg-muted/30 overflow-auto">
                    {operations.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        Watch operations appear in real-time...
                      </p>
                    ) : (
                      <div className="space-y-1 font-mono text-xs">
                        {operations.map((op, i) => (
                          <div
                            key={i}
                            className="text-foreground/70 px-2 py-1 rounded bg-primary/5 border-l-2 border-primary/50 animate-slide-up"
                            style={{ animationDuration: "0.3s" }}
                          >
                            {op}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                <span>Powered by @open-ot/core</span>
                <span className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Live
                </span>
              </div>
            </div>

            {/* Decorative element */}
            <div
              className="absolute -bottom-6 -right-6 w-24 h-24 bg-primary/10 rounded-full blur-2xl animate-pulse"
              style={{ animationDuration: "3s" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// Helper functions
function generateSimpleOp(oldDoc: string, newDoc: string): TextOperation {
  const op: TextOperation = [];
  if (oldDoc === newDoc) return op;

  let i = 0;
  while (i < Math.min(oldDoc.length, newDoc.length) && oldDoc[i] === newDoc[i])
    i++;

  if (i > 0) op.push({ r: i });

  if (newDoc.length > oldDoc.length) {
    op.push({ i: newDoc.slice(i, newDoc.length - (oldDoc.length - i)) });
  } else if (oldDoc.length > newDoc.length) {
    op.push({ d: oldDoc.length - newDoc.length });
  }

  return op;
}

function formatOperation(op: TextOperation): string {
  return op
    .map((component) => {
      if ("i" in component) return `insert("${component.i}")`;
      if ("d" in component) return `delete(${component.d})`;
      if ("r" in component) return `retain(${component.r})`;
      return "";
    })
    .filter(Boolean)
    .join(" → ");
}
