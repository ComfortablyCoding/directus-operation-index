import { defineOperationApp } from "@directus/extensions-sdk";

export default defineOperationApp({
  id: "index",
  name: "Index",
  icon: "search",
  description: "Index your data",
  overview: ({ engine, index, operation }) => [
    {
      label: "Engine",
      text: engine,
    },
    {
      label: "Operation",
      text: operation || "create",
    },
    {
      label: "Index",
      text: index,
    },
  ],
  options: (panel) => {
    const operation = panel.operation;

    const fields: any = [
      {
        field: "engine",
        name: "Engine",
        type: "string",
        meta: {
          width: "half",
          interface: "select-dropdown",
          required: true,
          options: {
            choices: [
              {
                text: "Algolia",
                value: "algolia",
              },
              {
                text: "Meilisearch",
                value: "meilisearch",
              },
            ],
          },
        },
      },
      {
        field: "operation",
        name: "Operation",
        type: "string",
        schema: {
          default_value: "create",
        },
        meta: {
          width: "half",
          interface: "select-dropdown",
          required: true,
          options: {
            choices: [
              {
                text: "Create",
                value: "create",
              },
              {
                text: "Update",
                value: "update",
              },
              {
                text: "Delete",
                value: "delete",
              },
            ],
          },
        },
      },
      {
        field: "index",
        name: "Index",
        type: "string",
        meta: {
          width: "full",
          interface: "input",
          required: true,
          options: {
            placeholder: "{{ $trigger.collection }}",
          },
          note: "Flow data variables such as **{{ $trigger.payload.id }}** are supported.",
        },
      },
    ];

    if (operation !== "read") {
      fields.push({
        field: "key",
        name: "Key",
        type: "string",
        meta: {
          width: "full",
          interface: "input",
          options: {
            placeholder: "{{ $trigger.key }}",
          },
          note: "Flow data variables such as **{{ $trigger.payload.id }}** are supported.",
        },
      });
    }

    if (operation !== "delete") {
      fields.push({
        field: "payload",
        name: "Payload",
        type: "json",
        meta: {
          width: "full",
          interface: "input-code",
          options: {
            language: "json",
            placeholder: JSON.stringify(
              {
                title: "Lorem Ipsum",
              },
              null,
              2,
            ),
            template: JSON.stringify(
              {
                title: "Lorem Ipsum",
              },
              null,
              2,
            ),
          },
        },
      });
    }

    return fields;
  },
});
