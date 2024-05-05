# directus-operation-index

A [Directus](https://directus.io/) index [operation](https://docs.directus.io/app/flows/operations.html) for [Flows](https://docs.directus.io/app/flows.html#flows).

## Install

###### NPM

```shell
npm install directus-operation-index
```

###### YARN

```shell
yarn add directus-operation-index
```

###### PNPM

```shell
pnpm add directus-operation-index
```

## Engines

The currently supported engines are `Meilisearch` and `Algolia`.

### Algolia Configuration

#### ENV
```txt
INDEX_ALGOLIA_APP_ID=APPLICATION_ID
INDEX_ALGOLIA_API_KEY=ADMIN_API_KEY
```

### Meilisearch Configuration

#### ENV
```txt
INDEX_MEILISEARCH_HOST=HOST
INDEX_MEILISEARCH_API_KEY=MASTER_KEY
```

> [!IMPORTANT]  
> If INDEX_MEILISEARCH_HOST is set to a local IP address then IMPORT_IP_DENY_LIST must be adjusted.

## Bugs

If any bugs are found please report them as a [Github Issue](https://github.com/ComfortablyCoding/directus-operation-index/issues)

## License

[MIT](https://github.com/ComfortablyCoding/directus-operation-index/blob/main/LICENSE)
