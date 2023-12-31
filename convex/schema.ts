import {
  EntDataModelFromSchema,
  defineEnt,
  getEntDefinition,
  defineEntSchema,
} from "./ents/schema";
import { v } from "convex/values";

const schema = defineEntSchema(
  {
    // messages: defineTable({
    //   text: v.string(),
    //   authorId: v.id("users"),
    // }).index("authorId", ["authorId"]),
    messages: defineEnt({
      text: v.string(),
    })
      .edge("user")
      .edges("tags"),

    users: defineEnt({
      name: v.string(),
    })
      .field("email", v.string(), { index: true })
      .edge("profile", { optional: true })
      .edges("messages")
      .edges("followers", "followees", { to: "users" })
      .edges("friends", { to: "users" }),
    // .edges("friends", "users"),

    profiles: defineEnt({
      bio: v.string(),
    }).edge("user"),

    tags: defineEnt({
      name: v.string(),
    }).edges("messages"),

    documents: defineEnt({
      fieldOne: v.string(),
      fieldTwo: v.object({
        subFieldOne: v.array(v.number()),
      }),
    }),
    // This definition matches the example query and mutation code:
    numbers: defineEnt({
      value: v.number(),
    }),
  },
  // If you ever get an error about schema mismatch
  // between your data and your schema, and you cannot
  // change the schema to match the current data in your database,
  // you can:
  //  1. Use the dashboard to delete tables or individual documents
  //     that are causing the error.
  //  2. Change this option to `false` and make changes to the data
  //     freely, ignoring the schema. Don't forget to change back to `true`!
  { schemaValidation: false }
);

export default schema;

export type EntDataModel = EntDataModelFromSchema<typeof schema>;

export const entDefinitions: EntDataModel = getEntDefinition(schema.tables);
