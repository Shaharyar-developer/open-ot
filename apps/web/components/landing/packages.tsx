import {
  ExternalLink,
  Package,
  Network,
  Database,
  Cloud,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";

// Package categories with proper organization
const packageCategories = [
  {
    title: "Core",
    icon: Package,
    description: "Foundation packages for OT functionality",
    packages: [
      {
        name: "@open-ot/core",
        description:
          "Core OT type system with TextType and JSON transformation",
        dependencies: [],
        features: [
          "Type-agnostic interface",
          "TextType implementation",
          "Transform & compose operations",
        ],
      },
    ],
  },
  {
    title: "Client & Server",
    icon: Network,
    description: "Synchronization and state management",
    packages: [
      {
        name: "@open-ot/client",
        description:
          "Client-side synchronization state machine with offline support",
        dependencies: ["@open-ot/core"],
        features: [
          "3-state synchronization",
          "Operation buffering",
          "Conflict resolution",
        ],
      },
      {
        name: "@open-ot/server",
        description:
          "Authoritative server for operation history and concurrency control",
        dependencies: ["@open-ot/core"],
        features: [
          "Operation catchup",
          "Backend adapter interface",
          "Multi-client coordination",
        ],
      },
    ],
  },
  {
    title: "Storage Adapters",
    icon: Database,
    description: "Persistence layer implementations",
    packages: [
      {
        name: "@open-ot/adapter-redis",
        description: "Redis adapter for operation logs and real-time presence",
        dependencies: ["@open-ot/server"],
        features: [
          "Fast operation storage",
          "Pub/sub support",
          "TTL management",
        ],
      },
      {
        name: "@open-ot/adapter-s3",
        description: "S3 adapter for snapshot storage and archival",
        dependencies: ["@open-ot/server"],
        features: [
          "Snapshot persistence",
          "Cost-effective archival",
          "Versioned backups",
        ],
      },
    ],
  },
  {
    title: "Network Transports",
    icon: Cloud,
    description: "Communication layer adapters",
    packages: [
      {
        name: "@open-ot/transport-websocket",
        description:
          "WebSocket transport for bidirectional real-time communication",
        dependencies: ["@open-ot/client"],
        features: ["Full-duplex messaging", "Auto-reconnection", "Low latency"],
      },
      {
        name: "@open-ot/transport-http-sse",
        description: "Server-Sent Events transport for serverless environments",
        dependencies: ["@open-ot/client"],
        features: ["Serverless compatible", "HTTP-based", "One-way streaming"],
      },
    ],
  },
];

export function Packages() {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container px-6 mx-auto max-w-7xl relative z-10">
        <div className="space-y-10">
          {/* Header */}
          <div className="space-y-4 text-center">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold">
              Modular <span className="text-primary">Architecture</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Composable packages that work together seamlessly. Mix and match
              to fit your stack.
            </p>
          </div>
          {/* Dependency Flow Visualization Hint */}
          <div className="rounded-xl backdrop-blur-sm">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground flex-wrap">
                <span>Dependency Flow</span>
                <ChevronsRight className="size-4 text-primary" />
                <code className="px-2 py-1 rounded bg-muted/50 font-mono">
                  core
                </code>
                <ChevronRight className="size-4 text-primary" />
                <code className="px-2 py-1 rounded bg-muted/50 font-mono">
                  client/server
                </code>
                <ChevronRight className="size-4 text-primary" />
                <code className="px-2 py-1 rounded bg-muted/50 font-mono">
                  adapters/transports
                </code>
              </div>
            </div>
          </div>
          {/* Package Categories */}
          <div className="space-y-16">
            {packageCategories.map((category, categoryIndex) => {
              const CategoryIcon = category.icon;
              return (
                <div
                  key={category.title}
                  className="space-y-6 animate-fade-in-up"
                  style={{ animationDelay: `${categoryIndex * 100}ms` }}
                >
                  {/* Category Header */}
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                      <CategoryIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">{category.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {category.description}
                      </p>
                    </div>
                  </div>

                  {/* Packages in Category */}
                  <div className="grid gap-1">
                    {category.packages.map((pkg, pkgIndex) => (
                      <div
                        key={pkg.name}
                        className="group relative p-3 sm:p-6 first:rounded-t-3xl last:rounded-b-3xl border border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:border-primary/30 flex flex-col sm:flex-row sm:items-center sm:justify-between rounded group gap-3"
                        style={{
                          animationDelay: `${categoryIndex * 100 + pkgIndex * 50}ms`,
                        }}
                      >
                        {/* Hover gradient */}
                        <div className="absolute inset-0 group-first:rounded-t-3xl group-last:rounded-b-3xl rounded  bg-linear-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                        <div className="relative grid md:grid-cols-[1fr,auto] gap-6">
                          {/* Left: Package Info */}
                          <div className="space-y-4">
                            {/* Package Name & Description */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-3 flex-wrap">
                                <a
                                  href={`https://www.npmjs.com/package/${pkg.name}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 font-mono text-base font-semibold text-primary group-hover:text-primary/80 transition-colors"
                                >
                                  {pkg.name}
                                  <ExternalLink className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                                </a>
                                {pkg.dependencies.length > 0 && (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <span className="text-xs">depends on:</span>
                                    {pkg.dependencies.map((dep, i) => (
                                      <span key={dep}>
                                        <code className="px-1.5 py-0.5 rounded bg-muted/50 font-mono text-xs">
                                          {dep.split("/")[1]}
                                        </code>
                                        {i < pkg.dependencies.length - 1 && (
                                          <span className="mx-1">,</span>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {pkg.description}
                              </p>
                            </div>

                            {/* Features */}
                            <div className="flex flex-wrap gap-2">
                              {pkg.features.map((feature) => (
                                <span
                                  key={feature}
                                  className="inline-flex items-center px-2.5 py-1 rounded-md bg-primary/5 border border-primary/10 text-xs font-medium text-foreground/80"
                                >
                                  {feature}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        {/* Right: Links */}
                        <div className="flex md:flex-col gap-2 text-sm md:items-end relative z-50 ml-auto">
                          <a
                            href={`https://www.npmjs.com/package/${pkg.name}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 bg-background/50 hover:bg-background hover:border-primary/30 transition-all text-xs font-medium"
                          >
                            npm <ChevronRight className="size-3" />
                          </a>
                          <a
                            href={`https://github.com/Shaharyar-developer/open-ot/tree/main/packages/${pkg.name.split("/")[1]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 bg-background/50 hover:bg-background hover:border-primary/30 transition-all text-xs font-medium"
                          >
                            source <ChevronRight className="size-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
