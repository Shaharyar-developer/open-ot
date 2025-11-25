import { Github } from "lucide-react";
import { Separator } from "@open-ot/ui/components/separator";

export function Footer() {
  return (
    <footer className="relative ">
      {/* Subtle gradient fade */}
      <div className="absolute inset-0 bg-linear-to-b from-transparent to-muted/20 pointer-events-none" />

      <div className="container px-6 mx-auto max-w-6xl relative z-10">
        <div className="space-y-8 py-12">
          <div className="flex flex-col md:flex-row justify-between gap-8">
            {/* Brand */}
            <div className="space-y-2">
              <p className="font-semibold">OpenOT</p>
              <p className="text-sm text-muted-foreground">
                Type-agnostic operational transformation
              </p>
            </div>

            {/* Links */}
            <div className="flex gap-12">
              <div className="space-y-3">
                <p className="text-sm font-medium">Resources</p>
                <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <a
                    href="/docs"
                    className="hover:text-foreground transition-colors"
                  >
                    Documentation
                  </a>
                  <a
                    href="https://www.npmjs.com/package/@open-ot/core"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors"
                  >
                    npm
                  </a>
                  <a
                    href="/examples"
                    className="hover:text-foreground transition-colors"
                  >
                    Examples
                  </a>
                </nav>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Community</p>
                <nav className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <a
                    href="https://github.com/your-org/openot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors flex items-center gap-1.5"
                  >
                    <Github className="w-3.5 h-3.5" />
                    GitHub
                  </a>
                  <a
                    href="https://github.com/your-org/openot/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors"
                  >
                    Issues
                  </a>
                  <a
                    href="/contributing"
                    className="hover:text-foreground transition-colors"
                  >
                    Contributing
                  </a>
                </nav>
              </div>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row justify-between gap-4 text-sm text-muted-foreground">
            <p>MIT License</p>
            <p>© 2025 OpenOT Contributors</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
