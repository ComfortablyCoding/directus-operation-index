import type { OperationContext } from '@directus/types';
import { expect, test, vi } from 'vitest';
import operation from './api.js';
import type { Options } from './options.js';

const engine = vi.hoisted(() => ({ upsert: vi.fn(), update: vi.fn(), delete: vi.fn() }));

// Records the index name with each call, so tests can check which index was written to.
vi.mock('./engines/registry.js', () => ({
	getEngine: () => ({
		index: (name: string) => ({
			upsert: (entries: unknown) => engine.upsert(name, entries),
			update: (entries: unknown) => engine.update(name, entries),
			delete: (keys: unknown) => engine.delete(name, keys),
		}),
	}),
}));

function run(options: Partial<Options>, trigger: Record<string, unknown> = {}) {
	const { handler } = operation as unknown as { handler: (options: Options, context: OperationContext) => unknown };
	const context = { env: {}, data: { $trigger: trigger } } as unknown as OperationContext;
	return handler({ engine: 'meilisearch', index: 'articles', ...options } as Options, context);
}

test('applies the payload to every key and returns what it did', async () => {
	const result = await run({ operation: 'update', key: [1, 2], payload: { title: 'A' } });

	expect(engine.update).toHaveBeenCalledWith('articles', [
		{ key: 1, data: { title: 'A' } },
		{ key: 2, data: { title: 'A' } },
	]);
	expect(result).toEqual({ engine: 'meilisearch', operation: 'update', index: 'articles', keys: [1, 2] });
});

test('defaults the keys and index to the trigger', async () => {
	await run({ operation: 'delete', index: '' }, { collection: 'posts', keys: ['a', 'b'] });

	expect(engine.delete).toHaveBeenCalledWith('posts', ['a', 'b']);
});

test('reads the collection and keys from a Manual trigger body', async () => {
	await run({ operation: 'delete', index: '' }, { body: { collection: 'posts', keys: ['a'] } });

	expect(engine.delete).toHaveBeenCalledWith('posts', ['a']);
});

test('ignores a Collection left over from Sync when choosing the index for other operations', async () => {
	await run({ operation: 'delete', index: '', collection: 'authors' }, { collection: 'posts', keys: ['a'] });

	expect(engine.delete).toHaveBeenCalledWith('posts', ['a']);
});

test.each([
	['a tag list', ['1', '2'], ['1', '2']],
	['a tag that resolved to a list', [[1, 2], '3'], [1, 2, '3']],
	['a string saved by 0.1', 'a', ['a']],
])('accepts keys from %s', async (_, key, keys) => {
	await run({ operation: 'delete', key });

	expect(engine.delete).toHaveBeenLastCalledWith('articles', keys);
});

test('runs an unset operation as Create when it has a payload, as 0.1 did', async () => {
	await run({ operation: null, key: 1, payload: { title: 'A' } });

	expect(engine.upsert).toHaveBeenCalledWith('articles', [{ key: 1, data: { title: 'A' } }]);
});

test.each([
	[{ engine: 'solr' as never }, '"solr" is not a supported engine'],
	[{ operation: 'index' as never }, '"index" is not a supported operation'],
	[{ operation: 'delete' as const }, '"key" is required when the trigger has no keys'],
	[{ operation: 'create' as const, key: 1 }, '"payload" must be an object'],
	[{ key: 1 }, '"collection" is required when the trigger has none'],
	[{ operation: 'sync' as const }, '"collection" is required when the trigger has none'],
])('rejects invalid options %#', async (options, reason) => {
	await expect(run(options)).rejects.toMatchObject({
		code: 'INVALID_PAYLOAD',
		message: `Invalid payload. ${reason}.`,
	});
});

test('rejects dynamic variables in the filter, which Directus would leave unresolved', async () => {
	const { handler } = operation as unknown as { handler: (options: Options, context: OperationContext) => unknown };
	const context = {
		env: {},
		data: { $trigger: { keys: [1] } },
		getSchema: async () => ({ collections: { articles: { primary: 'id' } } }),
	} as unknown as OperationContext;

	await expect(
		handler(
			{ engine: 'meilisearch', operation: 'sync', collection: 'articles', filter: { published_at: { _lte: '$NOW' } } },
			context,
		),
	).rejects.toMatchObject({
		code: 'INVALID_QUERY',
		message: 'Invalid query. "filter" does not support dynamic variables such as $NOW.',
	});
});
