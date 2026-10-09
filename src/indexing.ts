import type { Filter, Item, PrimaryKey, Query } from '@directus/types';
import type { Entry, SearchIndex } from './engines/engine.js';

// The ItemsService methods Sync and Reindex use.
export interface ItemsReader {
	readByQuery(query: Query): Promise<Item[]>;
	readMany(keys: PrimaryKey[], query: Query): Promise<Item[]>;
}

export interface SyncOptions {
	index: SearchIndex;
	service: ItemsReader;
	primaryKey: string;
	query: Query;
}

export interface SyncResult {
	indexed: number;
	removed: number;
}

// Reads the current database state, so event order does not matter.
export async function syncItems({
	index,
	service,
	primaryKey,
	query,
	keys,
}: SyncOptions & { keys: PrimaryKey[] }): Promise<SyncResult> {
	const items = await service.readMany(keys, toReadQuery(query, primaryKey));
	const found = new Set(items.map((item) => String(item[primaryKey])));
	const missing = keys.filter((key) => !found.has(String(key)));

	if (items.length > 0) {
		await index.upsert(toEntries(items, primaryKey));
	}
	if (missing.length > 0) {
		await index.delete(missing);
	}

	return { indexed: items.length, removed: missing.length };
}

export async function reindexCollection({
	index,
	service,
	primaryKey,
	query,
	batchSize = 500,
}: SyncOptions & { batchSize?: number }): Promise<SyncResult> {
	const { fields, filter } = toReadQuery(query, primaryKey);
	const indexed = new Set<string>();

	// Keyset pagination: fast on large tables and never skips items deleted mid-run.
	const read = (last?: PrimaryKey) => {
		const after: Filter | null = last === undefined ? null : { [primaryKey]: { _gt: last } };

		return service.readByQuery({
			fields,
			filter: filter && after ? { _and: [filter, after] } : (after ?? filter),
			sort: [primaryKey],
			limit: batchSize,
		});
	};

	// Stops only on an empty page: a short one may be capped by QUERY_LIMIT_MAX or a hook, and stopping
	// there would delete every document after it. The next page is read while this one is written.
	for (let items = await read(); items.length > 0;) {
		const next = read(items.at(-1)![primaryKey] as PrimaryKey);
		// Handled below; a failed read must not settle the run while the write still holds the index.
		next.catch(() => undefined);

		await index.upsert(toEntries(items, primaryKey));

		for (const item of items) {
			indexed.add(String(item[primaryKey]));
		}

		items = await next;
	}

	const stale: string[] = [];
	for await (const ids of index.documentIds()) {
		stale.push(...ids.filter((id) => !indexed.has(id)));
	}

	for (let i = 0; i < stale.length; i += batchSize) {
		await index.delete(stale.slice(i, i + batchSize));
	}

	return { indexed: indexed.size, removed: stale.length };
}

function toEntries(items: Item[], primaryKey: string): Entry[] {
	return items.map((item) => ({
		key: item[primaryKey] as PrimaryKey,
		data: item,
	}));
}

// Reads all fields when none are set, always including the primary key, and drops a filter left empty in the editor.
function toReadQuery({ fields, filter }: Query, primaryKey: string): Query {
	const selected = fields?.length ? fields : ['*'];

	return {
		fields: selected.includes('*') || selected.includes(primaryKey) ? selected : [primaryKey, ...selected],
		filter: filter && Object.keys(filter).length > 0 ? filter : null,
	};
}
