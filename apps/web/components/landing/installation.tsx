"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@open-ot/ui/components/tabs";
import { Button } from "@open-ot/ui/components/button";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  nord,
  materialOceanic,
} from "react-syntax-highlighter/dist/esm/styles/prism";

const examples = {
  react: {
    title: "React",
    install: `npm install @open-ot/core @open-ot/client @open-ot/transport-websocket`,
    code: `import { OTClient } from "@open-ot/client";
import { TextType } from "@open-ot/core";
import { WebSocketTransport } from "@open-ot/transport-websocket";

const transport = new WebSocketTransport("ws://localhost:3000");

const client = new OTClient({
  type: TextType,
  initialSnapshot: "Hello World",
  initialRevision: 0,
  transport: transport,
});

// Apply local changes
client.applyLocal([{ r: 5 }, { i: " Alice" }]);`,
  },
  nextjs: {
    title: "Next.js",
    install: `npm install @open-ot/core @open-ot/client @open-ot/server @open-ot/adapter-redis`,
    code: `// app/api/ot/route.ts
import { Server } from "@open-ot/server";
import { RedisAdapter } from "@open-ot/adapter-redis";
import { TextType } from "@open-ot/core";

const backend = new RedisAdapter(process.env.REDIS_URL);
const server = new Server(backend);
server.registerType(TextType);

export async function POST(req: Request) {
  const { docId, op, revision } = await req.json();
  const result = await server.submitOperation(docId, op, revision);
  return Response.json(result);
}`,
  },
  serverless: {
    title: "Serverless",
    install: `npm install @open-ot/core @open-ot/client @open-ot/transport-http-sse`,
    code: `import { OTClient } from "@open-ot/client";
import { HttpSseTransport } from "@open-ot/transport-http-sse";
import { TextType } from "@open-ot/core";

const transport = new HttpSseTransport("https://api.example.com", {
  eventsPath: "/events",
  messagesPath: "/messages",
});

const client = new OTClient({
  type: TextType,
  initialSnapshot: "",
  initialRevision: 0,
  transport,
});`,
  },
};

export function Installation() {
  const [activeTab, setActiveTab] = useState<keyof typeof examples>("react");
  const [copied, setCopied] = useState<"install" | "code" | null>(null);

  const handleCopy = async (text: string, type: "install" | "code") => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <section id="installation" className="py-24 md:py-32 relative">
      {/* Decorative element */}
      <div className="absolute top-20 right-0 w-72 h-72 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container px-6 mx-auto max-w-6xl relative z-10">
        <div className="space-y-12">
          {/* Header */}
          <div className="space-y-4 text-center animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 text-sm font-medium text-primary">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Installation
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold">
              Get Started in <span className="text-primary">Minutes</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Choose your framework and start building collaborative
              applications
            </p>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(value) =>
              setActiveTab(value as keyof typeof examples)
            }
            className="animate-fade-in-up"
          >
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
              <TabsTrigger value="react">React</TabsTrigger>
              <TabsTrigger value="nextjs">Next.js</TabsTrigger>
              <TabsTrigger value="serverless">Serverless</TabsTrigger>
            </TabsList>

            {Object.entries(examples).map(([key, example]) => (
              <TabsContent key={key} value={key} className="space-y-6 mt-6">
                {/* Install Command */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Install</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(example.install, "install")}
                      className="transition-colors"
                    >
                      {copied === "install" ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <div className="rounded-lg overflow-hidden border border-border/50 bg-transparent">
                    <SyntaxHighlighter
                      language="bash"
                      style={materialOceanic}
                      customStyle={{
                        margin: 0,
                        padding: "1rem",
                        fontSize: "0.875rem",
                        background: "hsl(var(--muted) / 0.3)",
                      }}
                    >
                      {example.install}
                    </SyntaxHighlighter>
                  </div>
                </div>

                {/* Code Example */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Usage</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(example.code, "code")}
                      className="transition-colors"
                    >
                      {copied === "code" ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <div className="rounded-lg overflow-hidden border border-border/50">
                    <SyntaxHighlighter
                      language="typescript"
                      style={materialOceanic}
                      customStyle={{
                        margin: 0,
                        padding: "1rem",
                        background: "hsl(var(--muted) / 0.3)",
                        fontSize: "0.875rem",
                      }}
                      showLineNumbers
                    >
                      {example.code}
                    </SyntaxHighlighter>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </section>
  );
}
