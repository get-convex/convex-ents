# Ents

Ents (short for entity) are Convex documents, which allow explicitly declaring
edges (relationships) to other documents. The simplest Ent has no fields besides
the built-in `_id` and `creationTime` fields, and no declared edges. Ents can
contain all the same field types Convex documents can. Ents are stored in tables
in the Convex database.

Unlike bare documents, Ents require a schema. Here's a minimal example of the
`schema.ts` file using Ents:

```ts
import { v } from "convex/values";
import { defineEnt, defineEntSchema, getEntDefinitions } from "convex-ent";

const schema = defineEntSchema({
  messages: defineEnt({
    text: v.string(),
  }).edge("user"),

  users: defineEnt({
    name: v.string(),
  }).edges("messages"),
});

export default schema;

export const entDefinitions = getEntDefinitions(schema);
```

`defineEntSchema` replaces `defineSchema` and `defineEnt` replaces `defineTable`
from `convex/server`. Besides exporting the `schema`, which is used by Convex
for schema validation, we also export `entDefinitions`, which include the
runtime information needed to enable retrieving Ents via edges and other
features.

## Fields

An Ent field is a field in its backing document. Some types of [edges](#edges)
add additional fields not directly specified in the schema.

For Ents fields can be further configured.

### Indexed fields

`defineEnt` provides a shortcut for declaring a field and a simple index over
the field. Indexes allow efficient point and range lookups and efficient sorting
of the results by the indexed field. The following schema:

```ts
defineSchema({
  users: defineEnt({}).field("email", v.string(), { index: true }),
});
```

declares that "users" ents have one field, `"email"` of type `string`, and one
index called `"email"` over the `"email"` field. It is exactly equivalent to the
following schema:

```ts
defineEntSchema({
  users: defineEnt({
    email: v.string(),
  }).index("email", ["email"]),
});
```

### Field defaults

When evolving a schema, especially in production, the simplest way to modify the
shape of documents in the database is to add an optional field. Having an
optional field means that our code either always has to handle the "missing"
value case (the value is `undefined`), or we need to perform a careful migration
to backfill all the documents and set the field value.

Ents simplify this shape evolution by allowing to specify a default for a field.
The following schema:

```ts
defineEntSchema({
  posts: defineEnt({}).field(
    "contentType",
    v.union(v.literal("text"), v.literal("video")),
    { default: "text" }
  ),
});
```

declares that "posts" ents have one **optional** field `"contentType"`,
containing a string, either `"text"` or `"video"`. When the value is missing
from the backing document, the default value `"text"` is returned. Without
specifying the default value, the schema could look like:

```ts
defineEntSchema({
  posts: defineEnt({
    contentType: v.optional(v.union(v.literal("text"), v.literal("video"))),
  }),
});
```

but for this schema the `contentType` field missing must be handled by the code
reading the ent.

## Edges

An edge is a representation of some business logic modelled by the database.
Some examples are:

- User A liking post X can be represented by an edge.
- User B authoring post Y can be represented by an edge.
- User C is friends with user D can be represented by an edge.

Every edge has two "ends", each being an Ent. Those Ents can be stored in the
same or in 2 different tables. Edges can represent symmetrical relationships.
The "friends with" edge is an example. If user C is friends with user D, then
user D is friends with user A. Symmetrical edge only make sense if both ends of
the edge point to Ents in the same table. Edges which are not symmetrical have
two names, one for each direction. For the user liking a post example, one
direction can be called "likedPosts" (from users to posts), the other "likers"
(from posts to users).

Edges can also declare how many Ents can be connected through the same edge. For
each end, there can be 0, 1 or many Ents connected to the same Ent on the other
side of the edge. For example, a user (represented by an Ent) has a profile
(represented by an Ent). In this case we call this a 1:1 edge. If we ask "how
many profiles does a user X have?" the answer is always 1. Similarly there can
be 1:many edges, such as user to authored messages, when each message has only a
single author; and many:many edges, such as messages to tags, where each message
can have many tags, and each tag can be attached to many messages.

Now that we understand all the properties of edges, here's how we can declare
them: Edges are always declared on the ents that constitute its ends. Let's take
the example of users authoring messages:

```ts
defineEntSchema({
  users: defineEnt({
    name: v.string(),
  }).edges("messages"),
  messages: defineEnt({
    text: v.string(),
  }).edge("users"),
});
```

In this example, the edge between "users" and "messages" is 1:many, each user
can have many associated messages, but each message has only a single associated
user. We know this because we used the `edge` method on the "messages" ent. To
declare a many:many edge, we could replace it with the `edges` method.

### Understanding how edges are stored

To further understand the ways in which edges can be declared, we need to
understand the difference in how they are stored. There are two ways edges are
stored in the database:

1. Field edges: These are stored as a single foreign key column in one of the
   two connected tables. These are used by default for 1:1 and 1:many edges.
2. Table edges: These are stored as documents in a separate table. They are
   required for many:many edges.

In the example above the edge is stored as an `Id<"users>` on the "messages"
document.

### 1:1 edges

1:1 edges are in a way a special case of 1:many edges. In Convex, one end of the
edge must be optional, because there is no way to "allocate" IDs before
documents are created (see [circular references](#)). Here's a basic example of
a 1:1 edge:

```ts
defineEntSchema({
  users: defineEnt({
    name: v.string(),
  }).edge("profile", { optional: true }),
  profiles: defineEnt({
    bio: v.string(),
  }).edge("user"),
});
```

In this case, each user can have 1 profile, and each profile must have 1
associated user. This is a field edge stored on the "profiles" table as a
foreign key. The column name is "userId" based on the "users" table name (itself
inferred from the provided "user" string).

If we wanted to have another field edge from profiles to users, we would have to
specify the field name. We can choose to specify the field name even if we have
only one edge:

```ts
defineEntSchema({
  users: defineEnt({
    name: v.string(),
  }).edge("profile", { ref: "ownerId", optional: true }),
  profiles: defineEnt({
    bio: v.string(),
  }).edge("user", { field: "ownerId" }),
});
```

We have to provide the field name on both ends of the edge (as `ref` and `field`
respectively).

Either way the name of the edge is tied to the tables names: "profile" and
"user" respectively for each direction of the edge (since this is not a
symmetrical edge). We can also provide the table names specifically, from either
or both ends:

```ts
defineEntSchema({
  users: defineEnt({
    name: v.string(),
  }).edge("info", { to: "profiles", ref: "ownerId", optional: true }),
  profiles: defineEnt({
    bio: v.string(),
  }).edge("owner", { to: "users", field: "ownerId" }),
});
```

The edge names are used when querying the edges, but they are not stored in the
database (the field name is, as part of each document that stores its value).

### 1:many edges

1:many edges are very common, and map clearly to foreign keys. Take this
example:

```ts
defineEntSchema({
  users: defineEnt({
    name: v.string(),
  }).edges("messages"),
  messages: defineEnt({
    text: v.string(),
  }).edge("user"),
});
```

This is a 1:many edge because the `edges` method is used on the "users" ent. And
since each user can have multiple associated messages, the foreign key must be
stored in the "messages" table. Just like for 1:1 edges, the field name is
inferred to be "userId" based on the "users" table name.

If we wanted to have another field edge from messages to users, we would have to
specify the field name. We can choose to specify the field name even if we have
only one edge:

```ts
defineEntSchema({
  users: defineEnt({
    name: v.string(),
  }).edges("messages", { ref: "authorId" }),
  messages: defineEnt({
    text: v.string(),
  }).edge("user", { field: "authorId" }),
});
```

Either way the name of the edge is tied to the tables' names: "messages" and
"user" respectively for each direction of the edge (since this is not a
symmetrical edge). We can also provide the table names explicitly, from either
or both ends:

```ts
defineEntSchema({
  users: defineEnt({
    name: v.string(),
  }).edges("authoredMessages", { to: "messages", ref: "authorId" }),
  messages: defineEnt({
    text: v.string(),
  }).edge("author", { to: "users", field: "authorId" }),
});
```

### many:many edges

Many:many edges are always stored in a separate table, and both ends of the edge
use the `edges` method:

```ts
defineEntSchema({
  messages: defineEnt({
    name: v.string(),
  }).edges("tags"),
  tags: defineEnt({
    text: v.string(),
  }).edge("messages"),
});
```

In this case the table storing the edge is called `messages_to_tags`, based on
the tables storing each end of the edge.

Similarly to field (1:many) edges, if we want to have multiple edges connecting
the same pair of tables, we have to provide the name of the table storing the
edge. We can do this even if we have only one edge:

```ts
defineEntSchema({
  messages: defineEnt({
    name: v.string(),
  }).edges("tags", { table: "messages_to_assignedTags" }),
  tags: defineEnt({
    text: v.string(),
  }).edge("messages", { table: "messages_to_assignedTags" }),
});
```

This table will have two ID fields, one for each end of the edge. Their names
will be inferred from the table names of the connected ents. You can specify
them explicitly using the `field` option.

As with 1:many edges, we can give the edges names:

```ts
defineEntSchema({
  messages: defineEnt({
    name: v.string(),
  }).edges("assignedTags", { to: "tags", table: "messages_to_assignedTags" }),
  tags: defineEnt({
    text: v.string(),
  }).edge("taggedMessages", {
    name: "messages",
    table: "messages_to_assignedTags",
  }),
});
```

#### Asymmetrical self-directed many:many edges

Self-directed edges have the ents on both ends of the edge stored in the same
table.

```ts
defineEntSchema({
  users: defineEnt({
    name: v.string(),
  }).edges("followers", { to: "users", inverse: "followees" }),
});
```

Self-directed edges point to the same table on which they are defined. For the
edge to be asymmetrical, it has to specify the `inverse` name. In this example,
if this edge is between user A and user B, B is a "followee" of A (is being
followed by A), and A is a "follower" of B.

We can also specify the `table`, `field` and `inverseField` options to control
how the edge is stored and to allow multiple self-directed edges.

#### Symmetrical self-directed many:many edges

Symmetrical edges also have the ents on both ends of the edge stored in the same
table, but additionally they "double-write" the edge for both directions:

```ts
defineEntSchema({
  users: defineEnt({
    name: v.string(),
  }).edges("friends", { to: "users" }),
});
```

By not specifying the `inverse` name, we're declaring the edge as symmetrical.
We can also specify the `table`, `field` and `inverseField` options to control
how the edge is stored and to allow multiple symmetrical self-directed edges.

Other kinds of edges are possible, but less common.
