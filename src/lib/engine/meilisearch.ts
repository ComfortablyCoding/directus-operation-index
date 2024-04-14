import type { Engine } from "../../types/class";
import type { MeilisearchEngineConfig } from "../../types/config";

import { MeiliSearch } from "meilisearch";

export class MeiliSearchEngine implements Engine {
  private client: MeiliSearch;
  constructor(config: MeilisearchEngineConfig) {
    this.client = new MeiliSearch(config);
  }

  keyField() {
    return "id";
  }

  readByQuery(index: string, query: string): Promise<unknown> {
    return this.client.index(index).search(query);
  }

  create<T = unknown>(
    index: string,
    key: string,
    payload: Record<string, T>,
  ): Promise<unknown> {
    return this.client
      .index(index)
      .addDocuments([{ [this.keyField()]: key, ...payload }]);
  }

  update<T = unknown>(
    index: string,
    key: string,
    payload: Record<string, T>,
  ): Promise<unknown> {
    return this.client
      .index(index)
      .updateDocuments([{ [this.keyField()]: key, ...payload }]);
  }

  delete(index: string, key: string): Promise<unknown> {
    return this.client.index(index).deleteDocument(key);
  }
}
