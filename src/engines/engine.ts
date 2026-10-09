import type { PrimaryKey } from '@directus/types';

export interface Entry {
	key: PrimaryKey;
	data: Record<string, unknown>;
}

export interface Engine {
	index(name: string): SearchIndex;
}

/** Environment variable values, keyed as in `env`, with those in `optionalEnv` possibly unset. */
export type EnvValues<K extends string, O extends K> = Record<Exclude<K, O>, string> & Partial<Record<O, string>>;

export interface EngineDefinition<Client = unknown, K extends string = string, O extends K = never> {
	/** The environment variables the client needs, keyed by the name `client` receives them under. */
	env: Record<K, string>;
	optionalEnv?: readonly O[];
	client(env: EnvValues<K, O>): Client;
	index(client: Client, name: string): SearchIndex;
}

export function defineEngine<Client, K extends string, O extends K = never>(
	definition: EngineDefinition<Client, K, O>,
): EngineDefinition<Client, K, O> {
	return definition;
}

// Writes create the index when it does not exist.
export interface SearchIndex {
	upsert(entries: Entry[]): Promise<void>;
	/** Merges fields into documents, creating any that are missing. */
	update(entries: Entry[]): Promise<void>;
	/** Removes documents. Missing documents are ignored. */
	delete(keys: PrimaryKey[]): Promise<void>;
	/** Yields every document ID in pages; yields nothing when the index does not exist. */
	documentIds(): AsyncIterable<string[]>;
}

// The key goes last so a payload field cannot overwrite it.
export function toDocument(entry: Entry, keyField: string, key: PrimaryKey = entry.key): Record<string, unknown> {
	return { ...entry.data, [keyField]: key };
}
