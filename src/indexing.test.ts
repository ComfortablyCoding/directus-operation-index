import type { Filter, Item, PrimaryKey, Query } from '@directus/types';
import { expect, test } from 'vitest';
import type { Entry, SearchIndex } from './engines/engine.js';
import { type ItemsReader, type SyncOptions, reindexCollection, syncItems } from './indexing.js';

class MemoryIndex implements SearchIndex {
	readonly documents = new Map<string, Record<string, unknown>>();

	async upsert(entries: Entry[]) {
		for (const { key, data } of entries) this.documents.set(String(key), data);
	}

	async update(entries: Entry[]) {
		await this.upsert(entries);
	}

	async delete(keys: PrimaryKey[]) {
		for (const key of keys) this.documents.delete(String(key));
	}

	async *documentIds() {
		yield [...this.documents.keys()];
	}

	ids() {
		return [...this.documents.keys()].toSorted();
	}
}

// Evaluates the filters the sync builds.
function matches(item: Item, filter: Filter | null | undefined): boolean {
	if (!filter) return true;
	if ('_and' in filter) return (filter._and as Filter[]).every((part) => matches(item, part));

	return Object.entries(filter).every(([field, condition]) =>
		Object.entries(condition as Record<string, unknown>).every(([operator, value]) => {
			if (operator === '_eq') return item[field] === value;
			if (operator === '_in') return (value as PrimaryKey[]).map(String).includes(String(item[field]));
			return item[field] > (value as number);
		}),
	);
}

function setup(items: Item[], maxLimit = Infinity) {
	const queries: Query[] = [];

	const readByQuery = async (query: Query) => {
		queries.push(query);
		return items.filter((item) => matches(item, query.filter)).slice(0, Math.min(query.limit ?? Infinity, maxLimit));
	};

	const service: ItemsReader = {
		readByQuery,
		// ItemsService.readMany adds the keys to the query's filter.
		readMany: (keys, query) =>
			readByQuery({ ...query, filter: { _and: [{ id: { _in: keys } }, query.filter ?? {}] }, limit: keys.length }),
	};

	const index = new MemoryIndex();
	const query: Query = { fields: ['title'], filter: { status: { _eq: 'published' } } };
	const options: SyncOptions = { index, service, primaryKey: 'id', query };

	return { index, service, options, queries };
}

test('indexes matching items and removes those that do not match or no longer exist', async () => {
	const { index, options, queries } = setup([
		{ id: 1, status: 'published' },
		{ id: 2, status: 'draft' },
	]);

	await index.upsert([
		{ key: 2, data: {} },
		{ key: 3, data: {} },
	]);

	expect(await syncItems({ ...options, keys: [1, 2, 3] })).toEqual({ indexed: 1, removed: 2 });
	expect(index.ids()).toEqual(['1']);
	expect(queries[0]?.fields).toEqual(['id', 'title']);
});

test('reindexes page by page and removes stale documents', async () => {
	const items = [1, 2, 3, 4, 5].map((id) => ({ id, status: 'published' }));
	const { index, options, queries } = setup(items);

	await index.upsert([{ key: 99, data: {} }]);

	expect(await reindexCollection({ ...options, batchSize: 2 })).toEqual({
		indexed: 5,
		removed: 1,
	});
	expect(index.ids()).toEqual(['1', '2', '3', '4', '5']);
	expect(queries.map((read) => read.filter)).toEqual([
		{ status: { _eq: 'published' } },
		{ _and: [{ status: { _eq: 'published' } }, { id: { _gt: 2 } }] },
		{ _and: [{ status: { _eq: 'published' } }, { id: { _gt: 4 } }] },
		{ _and: [{ status: { _eq: 'published' } }, { id: { _gt: 5 } }] },
	]);
});

test('keeps paging when Directus returns fewer items than requested', async () => {
	const items = [1, 2, 3, 4, 5].map((id) => ({ id, status: 'published' }));
	// Such as QUERY_LIMIT_MAX=2 with a batch size of 3.
	const { index, options } = setup(items, 2);

	await index.upsert(items.map((item) => ({ key: item.id, data: {} })));

	expect(await reindexCollection({ ...options, batchSize: 3 })).toEqual({
		indexed: 5,
		removed: 0,
	});
	expect(index.ids()).toEqual(['1', '2', '3', '4', '5']);
});

test('finishes the write in progress before failing on a read', async () => {
	const { index, service, options } = setup([{ id: 1, status: 'published' }]);
	const written: string[] = [];

	service.readByQuery = async (pageQuery) => {
		if (pageQuery.filter && '_and' in pageQuery.filter) throw new Error('read failed');
		return [{ id: 1 }];
	};
	index.upsert = async () => {
		await new Promise((resolve) => setTimeout(resolve, 10));
		written.push('1');
	};

	await expect(reindexCollection(options)).rejects.toThrow('read failed');
	expect(written).toEqual(['1']);
});
