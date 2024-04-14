export type Engine = "algolia" | "meilisearch";
export interface EngineConfigBase {
  /**
   * Underlying engine to send data
   *
   * `algolia`
   * `meilisearch`
   */
  engine: Engine;
}

export interface AlgoliaEngineConfig extends EngineConfigBase {
  engine: "algolia";
  appId: string;
  apiKey: string;
}

export interface MeilisearchEngineConfig extends EngineConfigBase {
  engine: "meilisearch";
  host: string;
  apiKey: string;
}

export type EngineConfig = AlgoliaEngineConfig | MeilisearchEngineConfig;
