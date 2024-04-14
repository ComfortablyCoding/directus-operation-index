import type { EngineConfig } from "../../types/config.js";
import { AlgoliaEngine } from "./algolia.js";
import { MeiliSearchEngine } from "./meilisearch.js";

export function createEngine(config: EngineConfig) {
  if (config.engine === "algolia") {
    return new AlgoliaEngine(config);
  }

  if (config.engine === "meilisearch") {
    return new MeiliSearchEngine(config);
  }

  throw new Error(`Invalid Engine configuration: Type does not exist.`);
}
