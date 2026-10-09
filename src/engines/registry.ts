import type { EngineName } from '../options.js';
import algolia from './algolia.js';
import type { Engine, EngineDefinition, EnvValues } from './engine.js';
import meilisearch from './meilisearch.js';
import typesense from './typesense.js';

type Env = Record<string, unknown>;

const definitions: Record<EngineName, EngineDefinition<unknown, string, string>> = { algolia, meilisearch, typesense };

const engines = new Map<EngineName, Engine>();

export function getEngine(engineName: EngineName, env: Env): Engine {
	let engine = engines.get(engineName);

	if (!engine) {
		const definition = definitions[engineName];
		const client = definition.client(getEnv(env, definition.env, definition.optionalEnv));

		engine = { index: (name) => definition.index(client, name) };
		engines.set(engineName, engine);
	}

	return engine;
}

// Directus casts numeric-looking values to numbers, so each is converted back to a string.
function getEnv<K extends string, O extends K>(
	env: Env,
	variables: Record<K, string>,
	optional: readonly O[] = [],
): EnvValues<K, O> {
	const values: Partial<Record<K, string>> = {};
	const missing: string[] = [];

	for (const [key, variable] of Object.entries(variables) as [K, string][]) {
		const value = env[variable];

		if (value === undefined || value === null || value === '') {
			if (!optional.includes(key as O)) missing.push(variable);
			continue;
		}

		values[key] = String(value);
	}

	if (missing.length > 0) throw new Error(`Missing environment variables: ${missing.join(', ')}`);

	return values as EnvValues<K, O>;
}
