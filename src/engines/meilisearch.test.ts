import type { Meilisearch } from 'meilisearch';
import { expect, test, vi } from 'vitest';
import meilisearch from './meilisearch.js';

function task(status: 'succeeded' | 'failed', code?: string) {
	const result = { uid: 7, status, error: code ? { message: 'boom', code } : null };
	return Object.assign(Promise.resolve({ taskUid: 7 }), { waitTask: async () => result });
}

function setup() {
	const index = {
		addDocuments: vi.fn(() => task('succeeded')),
		deleteDocuments: vi.fn(() => task('succeeded')),
		getDocuments: vi.fn(),
	};

	return { index, client: { index: () => index } as unknown as Meilisearch };
}

test('sets the primary key explicitly and lets the key win over a payload id', async () => {
	const { client, index } = setup();

	await meilisearch.index(client, 'articles').upsert([{ key: 1, data: { id: 'payload', title: 'A' } }]);

	expect(index.addDocuments).toHaveBeenCalledWith([{ id: 1, title: 'A' }], { primaryKey: 'id' });
});

test('fails when the Meilisearch task fails, except a delete from an index that does not exist yet', async () => {
	const { client, index } = setup();

	index.addDocuments.mockReturnValue(task('failed', 'invalid_document_id'));
	await expect(meilisearch.index(client, 'articles').upsert([{ key: 1, data: {} }])).rejects.toThrow(
		'Meilisearch task 7 failed: boom',
	);

	index.deleteDocuments.mockReturnValue(task('failed', 'index_not_found'));
	await expect(meilisearch.index(client, 'articles').delete([1])).resolves.toBeUndefined();
});

test('pages through document IDs, and lists none for an index that does not exist', async () => {
	const { client, index } = setup();
	const full = Array.from({ length: 1000 }, (_, id) => ({ id }));

	index.getDocuments.mockResolvedValueOnce({ results: full }).mockResolvedValueOnce({ results: [{ id: 'last' }] });
	const pages = await Array.fromAsync(meilisearch.index(client, 'articles').documentIds());

	expect(pages.map((ids) => ids.length)).toEqual([1000, 1]);
	expect(index.getDocuments.mock.calls.map(([params]) => params.offset)).toEqual([0, 1000]);

	index.getDocuments.mockRejectedValue(Object.assign(new Error(), { cause: { code: 'index_not_found' } }));
	expect(await Array.fromAsync(meilisearch.index(client, 'missing').documentIds())).toEqual([]);
});
