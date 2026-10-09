import { defineOperationApp } from '@directus/extensions-sdk';
import {
	ENGINE_LABELS,
	OPERATION_LABELS,
	getCollection,
	getOperation,
	isSupportedEngine,
	usesOption,
} from './options.js';

function toDropdownChoices(labels: Record<string, string>) {
	return Object.entries(labels).map(([value, text]) => ({ text, value }));
}

export default defineOperationApp({
	id: 'index',
	name: 'Search Index',
	icon: 'manage_search',
	description: 'Sync items to Algolia, Meilisearch or Typesense',
	overview: (options) => {
		const operation = getOperation(options.operation, options.payload);

		return [
			{ label: 'Operation', text: OPERATION_LABELS[operation] },
			{
				label: 'Search Engine',
				text: isSupportedEngine(options.engine) ? ENGINE_LABELS[options.engine] : options.engine,
			},
			{
				label: 'Index Name',
				text: options.index || getCollection(operation, options.collection) || '{{ $trigger.collection }}',
			},
		];
	},
	options: (panel) => {
		// The panel has no defaults, resolve the operation as the handler does.
		const operation = getOperation(panel.operation, panel.payload);

		return [
			{
				field: 'operation',
				name: 'Operation',
				type: 'string',
				schema: { default_value: 'sync' },
				meta: {
					width: 'half',
					interface: 'select-dropdown',
					required: true,
					options: { choices: toDropdownChoices(OPERATION_LABELS) },
				},
			},
			{
				field: 'engine',
				name: 'Search Engine',
				type: 'string',
				meta: {
					width: 'half',
					interface: 'select-dropdown',
					required: true,
					options: { choices: toDropdownChoices(ENGINE_LABELS) },
				},
			},
			{
				field: 'collection',
				name: 'Collection',
				type: 'string',
				meta: {
					width: 'half',
					interface: 'system-collection',
					options: { includeSystem: false, allowNone: true },
					note: "The Directus collection to read items from. Defaults to the trigger's.",
					hidden: !usesOption(operation, 'collection'),
				},
			},
			{
				field: 'index',
				name: 'Index Name',
				type: 'string',
				meta: {
					width: 'half',
					interface: 'input',
					options: {
						placeholder: getCollection(operation, panel.collection) || '{{ $trigger.collection }}',
					},
					note: 'The search engine index to write documents to.',
				},
			},
			{
				field: 'key',
				name: 'IDs',
				type: 'csv',
				meta: {
					width: 'full',
					// 0.1 saved a string, which Tags only shows from Directus 11.16, so it keeps an input until cleared.
					...(typeof panel.key === 'string' && panel.key !== ''
						? {
								interface: 'input',
								options: { placeholder: 'The trigger IDs' },
							}
						: {
								interface: 'tags',
								options: {
									placeholder: 'The trigger IDs',
									iconRight: 'vpn_key',
								},
							}),
					note:
						operation === 'sync'
							? 'The items to check: each is indexed if it matches the filter, otherwise removed from the index.'
							: 'The item IDs to write or delete documents for.',
					hidden: !usesOption(operation, 'key'),
				},
			},
			{
				field: 'fields',
				name: 'Fields',
				type: 'json',
				meta: {
					width: 'full',
					interface: 'tags',
					options: { placeholder: '*' },
					note: 'Supports relational paths such as `author.name`. Leave empty to index all fields.',
					hidden: !usesOption(operation, 'fields'),
				},
			},
			{
				field: 'filter',
				name: 'Filter',
				type: 'json',
				meta: {
					width: 'full',
					interface: 'system-filter',
					options: { collectionField: 'collection' },
					note: 'Only matching items are indexed; the rest will be removed. Dynamic variables such as $NOW are not supported.',
					hidden: !usesOption(operation, 'filter'),
				},
			},
			{
				field: 'payload',
				name: 'Payload',
				type: 'json',
				meta: {
					width: 'full',
					interface: 'input-code',
					options: { language: 'json', placeholder: '{{ $trigger.payload }}' },
					note: 'The data to write to each document. Create overwrites an existing document, Update merges into it.',
					hidden: !usesOption(operation, 'payload'),
				},
			},
		];
	},
});
