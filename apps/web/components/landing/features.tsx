import { Code2, Database, Wifi, Zap } from "lucide-react";

const features = [
  {
    icon: Code2,
    title: "Data Agnostic",
    description:
      "Built-in Text type, fully extensible for JSON, rich-text, or custom structures. Define your transform function—OpenOT handles the rest.",
    color: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
  },
  {
    icon: Zap,
    title: "Offline-First",
    description:
      "Operations queue locally when offline. Automatic sync when connection returns. Your users never lose work.",
    color: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
  },
  {
    icon: Database,
    title: "Storage Pluggable",
    description:
      "Redis, S3, Postgres, or anything. Implement getSnapshot() and appendOp() to use any database.",
    color: "text-purple-600 dark:text-purple-400 bg-purple-500/10",
  },
  {
    icon: Wifi,
    title: "Transport Optional",
    description:
      "WebSockets, HTTP-SSE, or build your own. Simple .send() and .onReceive() interface.",
    color: "text-cyan-600 dark:text-cyan-400 bg-cyan-500/10",
  },
];

export function Features() {
  return (
    <section className="py-24 md:py-32 animate-in fade-in-0 slide-in-from-bottom-15 duration-500 delay-500 delay-initial">
      <div className="container px-6 mx-auto max-w-6xl">
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group relative p-6 rounded-2xl  backdrop-blur-sm transition-all duration-300"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Accent gradient on hover */}

                <div className="relative space-y-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-3 rounded-xl ${feature.color} transition-all duration-300 shadow-sm`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-semibold group-hover:text-primary transition-colors">
                      {feature.title}
                    </h3>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
