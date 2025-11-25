import { docs } from "fumadocs-mdx:collections/server";
import { icons } from "lucide-react";
import { loader } from "fumadocs-core/source";
import { createElement } from "react";

export const source = loader({
  baseUrl: "/docs",
  // @ts-expect-error mdx types
  source: docs.toFumadocsSource(),
  icon(icon) {
    if (!icon) {
      // You may set a default icon
      return;
    }

    if (icon in icons) return createElement(icons[icon as keyof typeof icons]);
  },
});
