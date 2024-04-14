export interface Engine {
  keyField(): string;
  readByQuery(index: string, query: string): Promise<unknown>;
  create<T = unknown>(
    index: string,
    key: string,
    payload: Record<string, T>,
  ): Promise<unknown>;
  update<T = unknown>(
    index: string,
    key: string,
    payload: Record<string, T>,
  ): Promise<unknown>;
  delete(index: string, key: string): Promise<unknown>;
}
