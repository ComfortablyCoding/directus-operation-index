import { type EnqueuedTaskPromise, Meilisearch } from 'meilisearch';
import { type Entry, defineEngine, toDocument } from './engine.js';

const PRIMARY_KEY = 'id';
const PAGE_SIZE = 1000;
const TASK_TIMEOUT_MS = 5 * 60 * 1000;

function toDocuments(entries: Entry[]) {
	return entries.map((entry) => toDocument(entry, PRIMARY_KEY));
}

export default defineEngine({
	env: { host: 'INDEX_MEILISEARCH_HOST', apiKey: 'INDEX_MEILISEARCH_API_KEY' },
	optionalEnv: ['apiKey'],

	// A request that never settles would otherwise hang the Flow.
	client: ({ host, apiKey }) => new Meilisearch({ host, apiKey, timeout: 30_000 }),

	index: (client, indexName) => {
		const index = client.index(indexName);

		return {
			upsert: (entries) => waitForTask(index.addDocuments(toDocuments(entries), { primaryKey: PRIMARY_KEY })),

			update: (entries) =>
				waitForTask(
					index.updateDocuments(toDocuments(entries), {
						primaryKey: PRIMARY_KEY,
					}),
				),

			delete: (keys) =>
				waitForTask(index.deleteDocuments(keys.map(String)), {
					ignoreMissingIndex: true,
				}),

			async *documentIds() {
				for (let offset = 0; ; offset += PAGE_SIZE) {
					let page;

					try {
						page = await index.getDocuments({
							fields: [PRIMARY_KEY],
							limit: PAGE_SIZE,
							offset,
						});
					} catch (error) {
						if ((error as { cause?: { code?: string } }).cause?.code === 'index_not_found') return;
						throw error;
					}

					yield page.results.map((document) => String(document[PRIMARY_KEY]));

					if (page.results.length < PAGE_SIZE) return;
				}
			},
		};
	},
});

// Meilisearch only queues work; failures only show up in the finished task.
async function waitForTask(enqueued: EnqueuedTaskPromise, { ignoreMissingIndex = false } = {}): Promise<void> {
	const task = await enqueued.waitTask({ timeout: TASK_TIMEOUT_MS });

	if (task.status === 'failed' && !(ignoreMissingIndex && task.error?.code === 'index_not_found')) {
		throw new Error(`Meilisearch task ${task.uid} failed: ${task.error?.message ?? 'unknown error'}`, {
			cause: task.error,
		});
	}
}
