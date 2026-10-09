import type { Filter } from '@directus/types';

// The options shared by the editor (app.ts) and the handler (api.ts).
// The app bundles this file, so it imports types only.

export interface Options {
	engine: EngineName;
	/** Unset for operations saved by 0.1 or created through the API; see {@link getOperation}. */
	operation?: Operation | null;
	collection?: string;
	index?: string;
	/** The IDs field: a tag list, a resolved variable, or a string saved by 0.1. */
	key?: unknown;
	payload?: unknown;
	fields?: string[] | null;
	filter?: Filter | null;
}

export const ENGINE_LABELS = {
	algolia: 'Algolia',
	meilisearch: 'Meilisearch',
	typesense: 'Typesense',
} as const;

export type EngineName = keyof typeof ENGINE_LABELS;

export function isSupportedEngine(value: unknown): value is EngineName {
	return typeof value === 'string' && Object.hasOwn(ENGINE_LABELS, value);
}

export const OPERATION_LABELS = {
	sync: 'Sync items',
	reindex: 'Reindex collection',
	create: 'Create documents',
	update: 'Update documents',
	delete: 'Delete documents',
} as const;

export type Operation = keyof typeof OPERATION_LABELS;

export function isSupportedOperation(value: unknown): value is Operation {
	return typeof value === 'string' && Object.hasOwn(OPERATION_LABELS, value);
}

type OperationOption = Exclude<keyof Options, 'engine' | 'operation' | 'index'>;

/** Mirrors the README's "Used by" column. */
const OPERATION_OPTIONS: Record<Operation, OperationOption[]> = {
	sync: ['collection', 'fields', 'filter', 'key'],
	reindex: ['collection', 'fields', 'filter'],
	create: ['key', 'payload'],
	update: ['key', 'payload'],
	delete: ['key'],
};

export function usesOption(operation: Operation, option: OperationOption): boolean {
	return OPERATION_OPTIONS[operation].includes(option);
}

// Only Create and Update use a payload, so an unset operation is Create with one and Sync without.
export function getOperation(operation?: unknown, payload?: unknown): Operation {
	if (isSupportedOperation(operation)) return operation;

	return payload == null || payload === '' ? 'sync' : 'create';
}

// Ignores a Collection left over from switching to an operation that does not use it.
export function getCollection(operation: Operation, collection: unknown): string | undefined {
	if (!usesOption(operation, 'collection')) return;
	if (typeof collection !== 'string') return;

	return collection || undefined;
}
