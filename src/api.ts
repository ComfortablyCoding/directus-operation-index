import { defineOperationApi } from "@directus/extensions-sdk";
import { Engine } from "./types/config";
import { createEngine } from "./lib/engine/create";

export type Operation = "create" | "update" | "delete";

export interface Options {
  engine: Engine;
  operation: Operation;
  index: string;
  key?: string;
  payload?: Record<string, any>;
}

export default defineOperationApi<Options>({
  id: "index",
  handler: async (options, { env }) => {
    const operation = options.operation || "create";

    let engine;

    if (options.engine === "algolia") {
      engine = createEngine({
        engine: options.engine,
        appId: env.INDEX_ALGOLIA_APP_ID,
        apiKey: env.INDEX_ALGOLIA_API_KEY,
      });
    } else if (options.engine === "meilisearch") {
      engine = createEngine({
        engine: options.engine,
        host: env.INDEX_MEILISEARCH_HOST,
        apiKey: env.INDEX_MEILISEARCH_API_KEY,
      });
    } else {
      throw Error("Invalid engine provided");
    }

    if (!options.key) {
      throw new Error("A key value must be provided");
    }

    if (operation !== "delete" && !options.payload) {
      throw new Error("A payload must be provided");
    }

    try {
      if (operation === "create" && options.payload) {
        await engine.create(options.index, options.key, options.payload);
      } else if (operation === "update" && options.payload) {
        await engine.update(options.index, options.key, options.payload);
      } else if (operation === "delete") {
        await engine.delete(options.index, options.key);
      }
    } catch (error: any) {
      throw new Error(error.message);
    }
  },
});
