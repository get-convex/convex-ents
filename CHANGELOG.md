# 0.19.0

Adds `exports` field to package.json for all modules, enabling direct imports:
- `convex-ents/deletion`
- `convex-ents/functions`
- `convex-ents/schema`
- `convex-ents/shared`
- `convex-ents/writer`

# 0.18.1

Fixes installation (removed `postinstall` script).

# 0.18.0

Uses the new `ctx.db.get`, `ctx.db.patch`, `ctx.db.delete` and `ctx.db.replace`
APIs under the hood, with explicit table name argument. This future-proofs the
library against the old APIs being deprecated in the future. See
[Convex News announcement](https://news.convex.dev/db-table-name/).

# 0.17.0

When patching only edges, the document itself is left untouched. See
[#55](https://github.com/get-convex/convex-ents/pull/55).

# 0.16.0

Fixes typechecking for `convex` version `1.27.0` and above, by supporting
[staged table indexes](https://docs.convex.dev/database/reading-data/indexes/#staged-indexes)
configuration.

# 0.15.0

**Breaking** runtime change:

The replace method no longer erases all edges when the edge list isn't specified
at all. This was a bug.

Before: `user.replace({name: "Foo"})` and
`user.replace({name: "Foo", friends: []})` behaved the same. From now on the
first version doesn't delete the existing `friends` edges.

# 0.14.0

`v.union` is now supported at the top level of an ent definition.

# 0.13.0

**Breaking** schema change:

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
