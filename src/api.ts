import { InvalidPayloadError, InvalidQueryError } from '@directus/errors';
import { defineOperationApi } from '@directus/extensions-sdk';
import type { OperationContext, PrimaryKey } from '@directus/types';
import { getEngine } from './engines/registry.js';
import {
	type Options,
	getCollection,
	getOperation,
	isSupportedEngine,
	isSupportedOperation,
	usesOption,
} from './options.js';
import { type ItemsReader, type SyncResult, reindexCollection, syncItems } from './indexing.js';

export default defineOperationApi<Options>({
	id: 'index',
	handler: async (options, context) => {
		const { engine: engineName } = options;

		if (!isSupportedEngine(engineName)) {
			throw new InvalidPayloadError({
				reason: `"${String(engineName)}" is not a supported engine`,
			});
		}

		if (options.operation != null && !isSupportedOperation(options.operation)) {
			throw new InvalidPayloadError({
				reason: `"${String(options.operation)}" is not a supported operation`,
			});
		}

		const operation = getOperation(options.operation, options.payload);

		// Flows and ItemsService leave these as literal strings, which silently match the wrong items.
		if (usesOption(operation, 'filter') && /"\$(NOW|CURRENT_)/.test(JSON.stringify(options.filter ?? null))) {
			throw new InvalidQueryError({
				reason: '"filter" does not support dynamic variables such as $NOW',
			});
		}

		// Event Hook triggers put the collection and IDs at the top level, Manual triggers under body.
		const trigger = (context.data['$trigger'] ?? {}) as TriggerData & { body?: TriggerData };
		const triggerKeys = trigger.keys ?? trigger.key ?? trigger.body?.keys;
		const collection = getCollection(operation, options.collection) || trigger.collection || trigger.body?.collection;
		const indexName = options.index || collection;

		if (!indexName) {
			throw new InvalidPayloadError({
				reason: '"index" is required when the trigger has no collection',
			});
		}

		const index = getEngine(engineName, context.env).index(indexName);
		let result: SyncResult | { keys: PrimaryKey[] };

		switch (operation) {
			case 'sync': {
				const { service, primaryKey } = await getService(collection, context);
				const keys = getKeys(options.key, triggerKeys);
				const query = { fields: options.fields, filter: options.filter };
				result = await syncItems({ index, service, primaryKey, query, keys });
				break;
			}

			case 'reindex': {
				const { service, primaryKey } = await getService(collection, context);
				const query = { fields: options.fields, filter: options.filter };
				result = await reindexCollection({ index, service, primaryKey, query });
				break;
			}

			case 'delete': {
				const keys = getKeys(options.key, triggerKeys);
				await index.delete(keys);
				result = { keys };
				break;
			}

			case 'create':
			case 'update': {
				const keys = getKeys(options.key, triggerKeys);
				const { payload } = options;

				if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
					throw new InvalidPayloadError({
						reason: '"payload" must be an object',
					});
				}

				const entries = keys.map((key) => ({ key, data: payload as Record<string, unknown> }));
				await (operation === 'update' ? index.update(entries) : index.upsert(entries));
				result = { keys };
				break;
			}
		}

		return { engine: engineName, operation, index: indexName, ...result };
	},
});

interface TriggerData {
	collection?: string;
	key?: unknown;
	keys?: unknown;
}

// Uses the first of `value` and `fallback` with any keys. Tags hold one key each, and a tag such as
// {{ $trigger.keys }} resolves to a list of its own.
function getKeys(value: unknown, fallback: unknown): PrimaryKey[] {
	for (const candidate of [value, fallback]) {
		const keys = [candidate]
			.flat(2)
			.filter((key): key is PrimaryKey => typeof key === 'number' || (typeof key === 'string' && key !== ''));

		if (keys.length > 0) return keys;
	}

	throw new InvalidPayloadError({
		reason: '"key" is required when the trigger has no keys',
	});
}

// Named after Directus's getService. The Collection option excludes system collections, so ItemsService always applies.
async function getService(
	collection: string | undefined,
	{ services, getSchema }: OperationContext,
): Promise<{ service: ItemsReader; primaryKey: string }> {
	if (!collection) {
		throw new InvalidPayloadError({
			reason: '"collection" is required when the trigger has none',
		});
	}

	const schema = await getSchema();
	const primaryKey = schema.collections[collection]?.primary;

	if (!primaryKey) {
		throw new InvalidPayloadError({
			reason: `Collection "${collection}" does not exist`,
		});
	}

	return { service: new services.ItemsService(collection, { schema }), primaryKey };
}
