// @ts-nocheck
import * as __fd_glob_8 from "../content/docs/integrations/transport-websocket.mdx?collection=docs"
import * as __fd_glob_7 from "../content/docs/integrations/transport-sse.mdx?collection=docs"
import * as __fd_glob_6 from "../content/docs/integrations/react-ws.mdx?collection=docs"
import * as __fd_glob_5 from "../content/docs/integrations/nextjs-websocket.mdx?collection=docs"
import * as __fd_glob_4 from "../content/docs/integrations/nextjs-sse.mdx?collection=docs"
import * as __fd_glob_3 from "../content/docs/introduction.mdx?collection=docs"
import * as __fd_glob_2 from "../content/docs/getting-started.mdx?collection=docs"
import * as __fd_glob_1 from "../content/docs/concepts.mdx?collection=docs"
import { default as __fd_glob_0 } from "../content/docs/meta.json?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.docs("docs", "content/docs", {"meta.json": __fd_glob_0, }, {"concepts.mdx": __fd_glob_1, "getting-started.mdx": __fd_glob_2, "introduction.mdx": __fd_glob_3, "integrations/nextjs-sse.mdx": __fd_glob_4, "integrations/nextjs-websocket.mdx": __fd_glob_5, "integrations/react-ws.mdx": __fd_glob_6, "integrations/transport-sse.mdx": __fd_glob_7, "integrations/transport-websocket.mdx": __fd_glob_8, });