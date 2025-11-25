"use client";

import { useState, useEffect } from "react";
import { TextType, type TextOperation } from "@open-ot/core";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@open-ot/ui/components/tabs";

export function WorkingDemo() {
  const [document, setDocument] = useState("Hello World");
  const [operations, setOperations] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("Hello World");
  const [cursorPosition, setCursorPosition] = useState(11);

  useEffect(() => {
    setInputValue(document);
  }, [document]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursor = e.target.selectionStart || 0;

    // Generate operation based on diff
    const op = generateOperation(document, newValue);

    if (op.length > 0) {
      // Apply operation
      const newDoc = TextType.apply(document, op);
      setDocument(newDoc);

      // Log operation
      const opStr = formatOperation(op);
      setOperations((prev) => [...prev, opStr].slice(-10)); // Keep last 10
    }

    setInputValue(newValue);
    setCursorPosition(newCursor);
  };

  return (
    <section id="demo" className="py-24 md:py-40 relative overflow-x-hidden ">
      {/* Subtle background accent */}
      <div className="absolute top-1/12 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container px-6 mx-auto max-w-6xl relative z-10">
        <div className="space-y-12">
          {/* Header */}
          <div className="space-y-4 text-center">
            <div className="inline-block">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold relative">
                <span className="relative z-10">
                  See <span className="text-primary">OpenOT</span> in Action
                </span>
                <div className="absolute -bottom-3 left-0 right-0 h-1.5 bg-primary/10 -rotate-1" />
              </h2>
            </div>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Type below to see actual OT operations generated in real-time
              using OpenOT&apos;s TextType
            </p>
          </div>

          {/* Demo Interface */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Editor */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Text Editor</label>
              <textarea
                value={inputValue}
                onChange={handleInput}
                onSelect={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  setCursorPosition(target.selectionStart || 0);
                }}
                className="w-full h-72 p-4 rounded-lg border bg-background font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
                placeholder="Start typing..."
              />
              <p className="text-xs text-muted-foreground">
                Cursor position: {cursorPosition}
              </p>
            </div>

            {/* Operations View */}
            <div className="space-y-3">
              <Tabs defaultValue="ops" className="w-full">
                <TabsList>
                  <TabsTrigger value="ops">Operations</TabsTrigger>
                  <TabsTrigger value="doc">Document</TabsTrigger>
                </TabsList>

                <TabsContent value="ops" className="mt-3">
                  <div className="h-72 p-4 rounded-lg border bg-background overflow-auto">
                    {operations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Operations will appear here...
                      </p>
                    ) : (
                      <div className="space-y-1 font-mono text-xs">
                        {operations.map((op, i) => (
                          <div
                            key={i}
                            className={`text-foreground/80 px-2 py-1 rounded ${
                              i === operations.length - 1
                                ? "bg-blue-500/10 border-l-2 border-blue-500 animate-slide-up"
                                : ""
                            }`}
                          >
                            {op}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="doc" className="mt-3">
                  <div className="h-72 p-4 rounded-lg border bg-background overflow-auto">
                    <pre className="font-mono text-sm whitespace-pre-wrap wrap-break-word">
                      {document}
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            This demo uses{" "}
            <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">
              @open-ot/core
            </code>{" "}
            TextType to generate and apply operations locally
          </p>
        </div>
      </div>
    </section>
  );
}

// Helper to generate operation from document diff
function generateOperation(oldDoc: string, newDoc: string): TextOperation {
  const op: TextOperation = [];

  if (oldDoc === newDoc) return op;

  let i = 0;
  while (i < oldDoc.length && i < newDoc.length && oldDoc[i] === newDoc[i]) {
    i++;
  }

  let j = 0;
  while (
    j < oldDoc.length - i &&
    j < newDoc.length - i &&
    oldDoc[oldDoc.length - 1 - j] === newDoc[newDoc.length - 1 - j]
  ) {
    j++;
  }

  const deleteLen = oldDoc.length - i - j;
  const insertText = newDoc.slice(i, newDoc.length - j);

  if (i > 0) op.push({ r: i });
  if (deleteLen > 0) op.push({ d: deleteLen });
  if (insertText.length > 0) op.push({ i: insertText });

  return op;
}

// Helper to format operation for display
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
