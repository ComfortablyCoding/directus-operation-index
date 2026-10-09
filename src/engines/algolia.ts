import { searchClient } from '@algolia/client-search';
import { type Entry, defineEngine, toDocument } from './engine.js';

const PAGE_SIZE = 1000;

function toObjects(entries: Entry[]) {
	return entries.map((entry) => toDocument(entry, 'objectID', String(entry.key)) as { objectID: string });
}

export default defineEngine({
	env: { appId: 'INDEX_ALGOLIA_APP_ID', apiKey: 'INDEX_ALGOLIA_API_KEY' },

	client: ({ appId, apiKey }) => searchClient(appId, apiKey),

	index: (client, indexName) => ({
		async upsert(entries) {
			await client.saveObjects({ indexName, objects: toObjects(entries), waitForTasks: true });
		},

		async update(entries) {
			await client.partialUpdateObjects({
				indexName,
				objects: toObjects(entries),
				createIfNotExists: true,
				waitForTasks: true,
			});
		},

		async delete(keys) {
			await client.deleteObjects({ indexName, objectIDs: keys.map(String), waitForTasks: true });
		},

		async *documentIds() {
			if (!(await client.indexExists({ indexName }))) return;

			let cursor: string | undefined;

			do {
				const page = await client.browse({
					indexName,
					browseParams: { attributesToRetrieve: ['objectID'], hitsPerPage: PAGE_SIZE, cursor },
				});

				yield page.hits.map((hit) => hit.objectID);
				cursor = page.cursor;
			} while (cursor);
		},
	}),
});
