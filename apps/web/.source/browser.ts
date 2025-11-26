// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"concepts.mdx": () => import("../content/docs/concepts.mdx?collection=docs"), "getting-started.mdx": () => import("../content/docs/getting-started.mdx?collection=docs"), "introduction.mdx": () => import("../content/docs/introduction.mdx?collection=docs"), "api-reference/adapter-redis.mdx": () => import("../content/docs/api-reference/adapter-redis.mdx?collection=docs"), "api-reference/adapter-s3.mdx": () => import("../content/docs/api-reference/adapter-s3.mdx?collection=docs"), "api-reference/client.mdx": () => import("../content/docs/api-reference/client.mdx?collection=docs"), "api-reference/core.mdx": () => import("../content/docs/api-reference/core.mdx?collection=docs"), "api-reference/react.mdx": () => import("../content/docs/api-reference/react.mdx?collection=docs"), "api-reference/server.mdx": () => import("../content/docs/api-reference/server.mdx?collection=docs"), "api-reference/transport-http-sse.mdx": () => import("../content/docs/api-reference/transport-http-sse.mdx?collection=docs"), "api-reference/transport-websocket.mdx": () => import("../content/docs/api-reference/transport-websocket.mdx?collection=docs"), "integrations/nextjs-sse.mdx": () => import("../content/docs/integrations/nextjs-sse.mdx?collection=docs"), "integrations/nextjs-websocket.mdx": () => import("../content/docs/integrations/nextjs-websocket.mdx?collection=docs"), "integrations/react-ws.mdx": () => import("../content/docs/integrations/react-ws.mdx?collection=docs"), "integrations/transport-sse.mdx": () => import("../content/docs/integrations/transport-sse.mdx?collection=docs"), "integrations/transport-websocket.mdx": () => import("../content/docs/integrations/transport-websocket.mdx?collection=docs"), }),
};
export default browserCollections;