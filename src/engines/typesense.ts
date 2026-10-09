import { createInterface } from 'node:readline';
import { Client } from 'typesense';
import { type Entry, defineEngine, toDocument } from './engine.js';

type Document = { id: string };
type ImportAction = 'upsert' | 'emplace';

// IDs per delete request: they travel in the URL, which servers and proxies cap at a few KB.
const DELETE_BATCH_SIZE = 100;
const PAGE_SIZE = 1000;
const IMPORT_ATTEMPTS = 3;
// A value whose type differs from the one Typesense inferred from an earlier document.
const TYPE_MISMATCH = /^Field `(.+)` (?:must be|has an incorrect type)/;

export default defineEngine({
	env: { host: 'INDEX_TYPESENSE_HOST', apiKey: 'INDEX_TYPESENSE_API_KEY' },

	client: ({ host, apiKey }) => new Client({ nodes: [{ url: host }], apiKey, connectionTimeoutSeconds: 10 }),

	index: (client, indexName) => {
		const collection = () => client.collections(indexName);

		// Returns the documents Typesense rejected.
		async function importDocuments(documents: Document[], action: ImportAction) {
			const request = () => collection().documents().import(documents, { action, throwOnFail: false });
			let results;

			try {
				results = await request();
			} catch (error) {
				if (getHttpStatus(error) !== 404) throw error;

				// Documents mirror Directus items, so let Typesense infer the schema. 409: created by a concurrent write.
				await ignoreHttpStatus(409, () =>
					client.collections().create({
						name: indexName,
						fields: [{ name: '.*', type: 'auto', optional: true }],
						enable_nested_fields: true,
					}),
				);

				results = await request();
			}

			return results.flatMap((result, i) => (result.success ? [] : [{ document: documents[i]!, error: result.error }]));
		}

		// Retries documents rejected over a field whose inferred type changed.
		async function write(entries: Entry[], action: ImportAction): Promise<void> {
			let documents = entries.map((entry) => toDocument(entry, 'id', String(entry.key)) as Document);

			for (let attempt = 1; ; attempt++) {
				const failed = await importDocuments(documents, action);
				if (failed.length === 0) return;

				const fields = new Set(failed.flatMap(({ error }) => TYPE_MISMATCH.exec(error)?.[1] ?? []));

				if (fields.size === 0 || attempt === IMPORT_ATTEMPTS) {
					throw new Error(`Typesense rejected ${failed.length} of ${documents.length} documents: ${failed[0]!.error}`);
				}

				// Inferred fields keep their first type, such as author as an ID before the fields included author.name.
				// Dropping them lets Typesense infer the new type; dropping an object also drops its nested fields.
				const drop = [...fields].filter((field) => ![...fields].some((parent) => field.startsWith(`${parent}.`)));
				await collection().update({ fields: drop.map((name) => ({ name, drop: true })) });

				documents = failed.map(({ document }) => document);
			}
		}

		return {
			upsert: (entries) => write(entries, 'upsert'),

			update: (entries) => write(entries, 'emplace'),

			async delete(keys) {
				const ids = keys.map(String);
				// Backticks quote IDs so commas and other filter syntax are literal, but cannot quote a backtick.
				const quoted = ids.filter((id) => !id.includes('`')).map((id) => `\`${id}\``);

				for (let i = 0; i < quoted.length; i += DELETE_BATCH_SIZE) {
					const batch = quoted.slice(i, i + DELETE_BATCH_SIZE);

					await ignoreHttpStatus(404, () =>
						collection()
							.documents()
							.delete({ filter_by: `id:[${batch.join(',')}]` }),
					);
				}

				for (const id of ids.filter((value) => value.includes('`'))) {
					await ignoreHttpStatus(404, () => collection().documents(id).delete());
				}
			},

			// Streams the export, which would otherwise be buffered whole and could outlast the request timeout.
			async *documentIds() {
				let stream;

				try {
					stream = await collection().documents().exportStream({ include_fields: 'id' });
				} catch (error) {
					if (getHttpStatus(error) === 404) return;
					throw error;
				}

				let page: string[] = [];

				for await (const line of createInterface({ input: stream, crlfDelay: Infinity })) {
					if (line === '') continue;

					page.push((JSON.parse(line) as Document).id);

					if (page.length === PAGE_SIZE) {
						yield page;
						page = [];
					}
				}

				if (page.length > 0) yield page;
			},
		};
	},
});

function getHttpStatus(error: unknown): unknown {
	return (error as { httpStatus?: unknown }).httpStatus;
}

async function ignoreHttpStatus(httpStatus: number, request: () => Promise<unknown>): Promise<void> {
	try {
		await request();
	} catch (error) {
		if (getHttpStatus(error) !== httpStatus) throw error;
	}
}
