import { Readable } from 'node:stream';
import type { Client } from 'typesense';
import { expect, test, vi } from 'vitest';
import typesense from './typesense.js';

const notFound = () => Object.assign(new Error('Not found'), { httpStatus: 404 });

function setup() {
	const documents = {
		import: vi.fn(async (docs: unknown[]) => docs.map(() => ({ success: true }))),
		delete: vi.fn(),
		exportStream: vi.fn(),
	};
	const single = { delete: vi.fn() };
	const collection = { update: vi.fn() };
	const collections = { create: vi.fn() };

	const client = {
		collections: (name?: string) =>
			name ? { ...collection, documents: (id?: string) => (id ? single : documents) } : collections,
	};

	return { documents, single, collection, collections, client: client as unknown as Client };
}

test('stores the key as a string id, creating the collection when it does not exist yet', async () => {
	const { client, documents, collections } = setup();
	documents.import.mockRejectedValueOnce(notFound());

	await typesense.index(client, 'articles').update([{ key: 1, data: { id: 'payload', title: 'A' } }]);

	expect(collections.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'articles' }));
	expect(documents.import).toHaveBeenCalledTimes(2);
	expect(documents.import).toHaveBeenLastCalledWith([{ id: '1', title: 'A' }], {
		action: 'emplace',
		throwOnFail: false,
	});
});

test('drops a field whose type changed and imports the rejected documents again', async () => {
	const { client, documents, collection } = setup();
	documents.import.mockResolvedValueOnce([
		{ success: true },
		{ success: false, error: 'Field `author` must be an int64.' },
	] as never);

	await typesense.index(client, 'articles').upsert([
		{ key: 1, data: { author: 5 } },
		{ key: 2, data: { author: { name: 'Ada' } } },
	]);

	expect(collection.update).toHaveBeenCalledWith({ fields: [{ name: 'author', drop: true }] });
	expect(documents.import).toHaveBeenLastCalledWith([{ id: '2', author: { name: 'Ada' } }], expect.anything());
});

test('fails on documents rejected for other reasons', async () => {
	const { client, documents, collection } = setup();
	documents.import.mockResolvedValueOnce([{ success: false, error: 'Bad JSON.' }] as never);

	await expect(typesense.index(client, 'articles').upsert([{ key: 1, data: {} }])).rejects.toThrow(
		'Typesense rejected 1 of 1 documents: Bad JSON.',
	);
	expect(collection.update).not.toHaveBeenCalled();
});

test('deletes by a quoted ID filter, one by one for IDs containing a backtick', async () => {
	const { client, documents, single } = setup();

	await typesense.index(client, 'articles').delete([1, 'a,b', 'x`y']);

	expect(documents.delete).toHaveBeenCalledWith({ filter_by: 'id:[`1`,`a,b`]' });
	expect(single.delete).toHaveBeenCalledOnce();
});

test('deletes in batches that keep the URL short', async () => {
	const { client, documents } = setup();

	await typesense.index(client, 'articles').delete(Array.from({ length: 250 }, (_, id) => id));

	expect(documents.delete).toHaveBeenCalledTimes(3);
});

test('reads document IDs from an export, and none for a missing collection', async () => {
	const { client, documents } = setup();

	const lines = Array.from({ length: 1001 }, (_, id) => `{"id":"${id}"}\n`);
	documents.exportStream.mockResolvedValueOnce(Readable.from(lines));
	const pages = await Array.fromAsync(typesense.index(client, 'articles').documentIds());
	expect(pages.map((ids) => ids.length)).toEqual([1000, 1]);
	expect(pages[1]).toEqual(['1000']);

	documents.exportStream.mockRejectedValueOnce(notFound());
	expect(await Array.fromAsync(typesense.index(client, 'missing').documentIds())).toEqual([]);
});
