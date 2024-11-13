# 0.13.0

Breaking schema change:

- The syntax for 1:1 edge declaration has been aligned with 1:many edges.
  Before:

  ```ts
  defineEntSchema({
    users: defineEnt({
      name: v.string(),
    }).edges("messages", { optional: true }),
    messages: defineEnt({
      text: v.string(),
    }).edge("user"),
  });
  ```

  Now:

  ```ts
  defineEntSchema({
    users: defineEnt({
      name: v.string(),
    }).edges("messages", { ref: true }),
    messages: defineEnt({
      text: v.string(),
    }).edge("user"),
  });
  ```

  The `optional` flag is now reserved for the direction which stores the field:

  ```ts
  defineEntSchema({
    users: defineEnt({
      name: v.string(),
    }).edges("messages", { ref: true }),
    messages: defineEnt({
      text: v.string(),
    }).edge("user", { field: "userId", optional: true }),
  });
  ```

  In this case `field` is required to avoid ambiguity with the previous syntax,
  but this constraint might be removed in the future.

- Added support for edges to `_storage` and `_scheduled_functions`
