# directus-operation-index

A [Directus](https://directus.io/) Flow operation that keeps collections in sync with
[Algolia](https://www.algolia.com/), [Meilisearch](https://www.meilisearch.com/) or [Typesense](https://typesense.org/).

![A Flow that syncs articles to Meilisearch on every change](https://github.com/user-attachments/assets/616cc196-bfae-47c1-bcd1-1d1efb49a2e3)

## Features

- [Sync items](#keep-an-index-in-sync) on every create, update and delete, removing those that no longer match the
  filter
- [Reindex a collection](#reindex-a-collection) without downtime
- [Choose the fields and items](#options) to index, including relational fields such as `author.name`
- [Create, update and delete documents](#operations) directly from a payload
- Algolia, Meilisearch and Typesense, with the index created on first write

## Installation

Requires Directus 11 or 12. Install it from the Directus Marketplace, or with npm in your Directus project:

```shell
npm install directus-operation-index
```

The operation reads items and calls your search engine, so it runs outside the extensions sandbox: the Marketplace only
lists it when `MARKETPLACE_TRUST=all` is set.

Then set the credentials for the engines you use:

| Engine      | Environment variables                                                                   |
| ----------- | --------------------------------------------------------------------------------------- |
| Algolia     | `INDEX_ALGOLIA_APP_ID`, `INDEX_ALGOLIA_API_KEY` (an admin API key)                      |
| Meilisearch | `INDEX_MEILISEARCH_HOST`, `INDEX_MEILISEARCH_API_KEY` (optional without a master key)   |
| Typesense   | `INDEX_TYPESENSE_HOST` (for example `http://localhost:8108`), `INDEX_TYPESENSE_API_KEY` |

## Usage

Add a **Search Index** operation to a Flow. Most collections need two Flows: one to keep the index in sync, and one to
reindex.

### Keep an index in sync

Use an **Event Hook** trigger (Action, non-blocking) on `items.create`, `items.update` and `items.delete` for the
collection, followed by a Search Index operation set to **Sync items**. Leave IDs empty: they come from the trigger.

Sync reads each item from Directus, so the order events arrive in doesn't matter. Items that match the filter are
indexed; the rest, including deleted items, are removed from the index.

### Reindex a collection

Use a **Manual** trigger on the collection, or a **Schedule** trigger, followed by a Search Index operation set to
**Reindex collection**. Run it once after setting up sync, and again after changing the fields or filter.

Reindex writes every matching item to the live index, then removes documents for items that no longer exist or match, so
search keeps working throughout.

### Options

![The options for syncing articles to Meilisearch](https://github.com/user-attachments/assets/6e707069-1ab5-41e4-a3dd-9a26cb172ed8)

| Option        | Used by                      | Description                                                                                                |
| ------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Operation     | all                          | See [Operations](#operations). When unset, Create if a payload is set, otherwise Sync.                     |
| Search Engine | all                          | Algolia, Meilisearch or Typesense.                                                                         |
| Collection    | Sync, Reindex                | The collection to read items from. Defaults to the trigger's; choose one to build a filter.                |
| Index Name    | all                          | The index to write documents to (a collection in Typesense). Defaults to the collection name.              |
| IDs           | Sync, Create, Update, Delete | One ID per tag, or a variable such as `{{ $trigger.keys }}`. Defaults to the trigger's `keys` or `key`.    |
| Fields        | Sync, Reindex                | Fields to index, including relational paths such as `author.name`. Defaults to all fields.                 |
| Filter        | Sync, Reindex                | Only matching items are indexed, such as `status` equals `published`. Dynamic variables are not supported. |
| Payload       | Create, Update               | The document data, for example `{{ $trigger.payload }}`. Applied to every ID.                              |

### Operations

| Operation              | What it does                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| **Sync items**         | Indexes the items that match the filter and removes the rest from the index, including deleted ones. |
| **Reindex collection** | Indexes every matching item, then removes documents for items that no longer exist or match.         |
| **Create documents**   | Writes the payload as whole documents, overwriting existing ones.                                    |
| **Update documents**   | Merges the payload into documents, creating any that are missing.                                    |
| **Delete documents**   | Removes documents.                                                                                   |

The operation returns what it did, which shows in the Flow's logs and is available to later operations:

![A Sync run that indexed one article](https://github.com/user-attachments/assets/a670b726-2267-4e42-9c62-aa96823f5f8d)

### How documents are built

The item's primary key is the document ID: `id` in Meilisearch and Typesense, `objectID` in Algolia. A field with that
name is replaced by the key.

Sync and Reindex read items without permission checks, so the index reflects the operation's settings rather than a
user. Avoid indexing private fields.

Typesense collections get an automatic schema. Typesense fixes each field's type when it first sees it, so when a type
changes, such as `author` going from an ID to an object after adding `author.name`, the operation drops the field from
the schema and lets Typesense infer it again.

### Limitations

- Filters can't use dynamic variables such as `$NOW` or `$CURRENT_USER`, and the operation rejects them. Flows pass them
  through unresolved, so they would match the wrong items
  ([discussion](https://github.com/directus/directus/discussions/15333)).
- Changes to related items aren't propagated. If articles index `author.name`, renaming an author updates its articles
  on their next change or the next reindex.
- Writes to the same index aren't ordered, so quick successive changes to an item can occasionally leave its document
  out of date until the next reindex.
- Meilisearch only accepts document IDs made of letters, digits, `-` and `_`.
- Use a separate index per collection: shared indexes collide on IDs, and reindexing one collection would remove the
  other's documents.

## License

[MIT](LICENSE)
