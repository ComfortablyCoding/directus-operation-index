import { expect, test } from 'vitest';
import { getEngine } from './registry.js';

test('lists every missing environment variable at once', () => {
	expect(() => getEngine('algolia', {})).toThrow(
		'Missing environment variables: INDEX_ALGOLIA_APP_ID, INDEX_ALGOLIA_API_KEY',
	);
});

test('treats empty values as missing', () => {
	expect(() =>
		getEngine('typesense', { INDEX_TYPESENSE_HOST: 'http://localhost:8108', INDEX_TYPESENSE_API_KEY: '' }),
	).toThrow('Missing environment variables: INDEX_TYPESENSE_API_KEY');
});

test('allows optional variables to be unset', () => {
	expect(getEngine('meilisearch', { INDEX_MEILISEARCH_HOST: 'http://localhost:7700' })).toBeDefined();
});
