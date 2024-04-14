import type { Engine } from "../../types/class.js";
import type { AlgoliaEngineConfig } from "../../types/config.js";
import type { SearchClient as AlgoliaClient } from "algoliasearch";
import algoliasearch from "algoliasearch";

export class AlgoliaEngine implements Engine {
  private client: AlgoliaClient;
  constructor(config: AlgoliaEngineConfig) {
    this.client = algoliasearch(config.appId, config.apiKey);
  }

  keyField() {
    return "objectID";
  }

  readByQuery(index: string, query: string): Promise<unknown> {
    return this.client.initIndex(index).search(query);
  }

  async create<T = unknown>(
    index: string,
    key: string,
    payload: Record<string, T>,
  ): Promise<void> {
    await this.client
      .initIndex(index)
      .saveObject({ [this.keyField()]: key, ...payload });
  }

  async update<T = unknown>(
    index: string,
    key: string,
    payload: Record<string, T>,
  ): Promise<void> {
    await this.client
      .initIndex(index)
      .partialUpdateObject({ [this.keyField()]: key, ...payload });
  }

  async delete(index: string, key: string): Promise<void> {
    await this.client.initIndex(index).deleteObject(key);
  }
}
