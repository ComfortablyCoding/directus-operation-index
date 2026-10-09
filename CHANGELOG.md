# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-10-09

### Added

- **Sync items** and **Reindex collection** operations, with Fields and Filter options.
- Typesense and Directus 12 support.
- The index defaults to the collection name, and IDs to the trigger's keys.
- The operation returns what it did.
- A Docker Compose playground.

### Changed

- **Breaking:** requires Directus 11 or 12 and Node.js 22.12 or later.
- Renamed to **Search Index**; new operations default to **Sync items**.
- IDs are entered as tags, and the Flow editor only shows the options the selected operation uses.
- Invalid options fail with Directus errors.
- Upgraded the Algolia and Meilisearch clients.

### Fixed

- Meilisearch failures were reported as successes.
- Meilisearch could fail to infer the primary key.
- A payload field named `id` or `objectID` could overwrite the document ID.
- Delete operations using `{{ $trigger.key }}` found no keys.

## [0.1.3] - 2024-05-05

### Added

- Document the environment variables for each engine.

## [0.1.2] - 2024-04-15

### Fixed

- Install instructions in the README.

## [0.1.1] - 2024-04-14

### Fixed

- Add license metadata to `package.json`.

## [0.1.0] - 2024-04-14

### Added

- Index operation for Flows, supporting Algolia and Meilisearch.

[Unreleased]: https://github.com/ComfortablyCoding/directus-operation-index/compare/0.2.0...HEAD
[0.2.0]: https://github.com/ComfortablyCoding/directus-operation-index/compare/0.1.3...0.2.0
[0.1.3]: https://github.com/ComfortablyCoding/directus-operation-index/compare/0.1.2...0.1.3
[0.1.2]: https://github.com/ComfortablyCoding/directus-operation-index/compare/0.1.1...0.1.2
[0.1.1]: https://github.com/ComfortablyCoding/directus-operation-index/compare/0.1.0...0.1.1
[0.1.0]: https://github.com/ComfortablyCoding/directus-operation-index/releases/tag/0.1.0
