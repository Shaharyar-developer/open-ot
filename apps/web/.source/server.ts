// @ts-nocheck
import * as __fd_glob_17 from "../content/docs/integrations/transport-websocket.mdx?collection=docs"
import * as __fd_glob_16 from "../content/docs/integrations/transport-sse.mdx?collection=docs"
import * as __fd_glob_15 from "../content/docs/integrations/react-ws.mdx?collection=docs"
import * as __fd_glob_14 from "../content/docs/integrations/nextjs-websocket.mdx?collection=docs"
import * as __fd_glob_13 from "../content/docs/integrations/nextjs-sse.mdx?collection=docs"
import * as __fd_glob_12 from "../content/docs/api-reference/transport-websocket.mdx?collection=docs"
import * as __fd_glob_11 from "../content/docs/api-reference/transport-http-sse.mdx?collection=docs"
import * as __fd_glob_10 from "../content/docs/api-reference/server.mdx?collection=docs"
import * as __fd_glob_9 from "../content/docs/api-reference/react.mdx?collection=docs"
import * as __fd_glob_8 from "../content/docs/api-reference/core.mdx?collection=docs"
import * as __fd_glob_7 from "../content/docs/api-reference/client.mdx?collection=docs"
import * as __fd_glob_6 from "../content/docs/api-reference/adapter-s3.mdx?collection=docs"
import * as __fd_glob_5 from "../content/docs/api-reference/adapter-redis.mdx?collection=docs"
import * as __fd_glob_4 from "../content/docs/introduction.mdx?collection=docs"
import * as __fd_glob_3 from "../content/docs/getting-started.mdx?collection=docs"
import * as __fd_glob_2 from "../content/docs/concepts.mdx?collection=docs"
import { default as __fd_glob_1 } from "../content/docs/api-reference/meta.json?collection=docs"
import { default as __fd_glob_0 } from "../content/docs/meta.json?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.docs("docs", "content/docs", {"meta.json": __fd_glob_0, "api-reference/meta.json": __fd_glob_1, }, {"concepts.mdx": __fd_glob_2, "getting-started.mdx": __fd_glob_3, "introduction.mdx": __fd_glob_4, "api-reference/adapter-redis.mdx": __fd_glob_5, "api-reference/adapter-s3.mdx": __fd_glob_6, "api-reference/client.mdx": __fd_glob_7, "api-reference/core.mdx": __fd_glob_8, "api-reference/react.mdx": __fd_glob_9, "api-reference/server.mdx": __fd_glob_10, "api-reference/transport-http-sse.mdx": __fd_glob_11, "api-reference/transport-websocket.mdx": __fd_glob_12, "integrations/nextjs-sse.mdx": __fd_glob_13, "integrations/nextjs-websocket.mdx": __fd_glob_14, "integrations/react-ws.mdx": __fd_glob_15, "integrations/transport-sse.mdx": __fd_glob_16, "integrations/transport-websocket.mdx": __fd_glob_17, });