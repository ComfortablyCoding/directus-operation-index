# Contributing

## Development

```shell
pnpm install
pnpm dev          # rebuild on change
pnpm test
pnpm lint
pnpm format
pnpm typecheck
```

## Playground

Runs the latest Directus with the built extension mounted, plus Meilisearch and Typesense, at http://localhost:8055
(`admin@example.com` / `password`). Run `pnpm dev` alongside it, and Directus reloads the extension on every rebuild:

```shell
pnpm build
docker compose -f playground/compose.yaml up -d --wait
docker compose -f playground/compose.yaml down --volumes   # stop and delete all data
```

To pin a Directus version, change the port or try Algolia, copy [`playground/.env.example`](playground/.env.example) to
`playground/.env`.

## Releasing

1. Move the **Unreleased** entries in [CHANGELOG.md](CHANGELOG.md) under the new version and bump `version` in
   `package.json`.
2. Publish a GitHub release whose tag is the version, for example `0.2.0`.

The release workflow publishes to npm using [trusted publishing](https://docs.npmjs.com/trusted-publishers), so no npm
token is stored in the repository. Configure the trusted publisher on npmjs.com once: repository
`ComfortablyCoding/directus-operation-index`, workflow `release.yml`.
