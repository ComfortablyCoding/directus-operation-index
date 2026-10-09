import type { SearchClient } from '@algolia/client-search';
import { expect, test, vi } from 'vitest';
import algolia from './algolia.js';

test('stores the key as a string objectID that a payload field cannot overwrite', async () => {
	const client = { saveObjects: vi.fn() };

	await algolia
		.index(client as unknown as SearchClient, 'articles')
		.upsert([{ key: 1, data: { objectID: 'payload', title: 'A' } }]);

	expect(client.saveObjects).toHaveBeenCalledWith(
		expect.objectContaining({ objects: [{ objectID: '1', title: 'A' }] }),
	);
});

test('follows the browse cursor through every document ID', async () => {
	const client = {
		indexExists: vi.fn(async () => true),
		browse: vi
			.fn()
			.mockResolvedValueOnce({ hits: [{ objectID: '1' }], cursor: 'next' })
			.mockResolvedValueOnce({ hits: [{ objectID: '2' }] }),
	};

	const pages = await Array.fromAsync(algolia.index(client as unknown as SearchClient, 'articles').documentIds());

	expect(pages).toEqual([['1'], ['2']]);
	expect(client.browse.mock.calls[1]![0].browseParams.cursor).toBe('next');
});
