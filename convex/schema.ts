import {
  EntDataModelFromSchema,
  defineEnt,
  getEntDefinition,
  defineEntSchema,
} from "./ents/schema";
import { v } from "convex/values";

const schema = defineEntSchema(
  {
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

    profiles: defineEnt({
      bio: v.string(),
    }).edge("user"),

    tags: defineEnt({
      name: v.string(),
    }).edges("messages"),
  },
  { schemaValidation: false }
);

export default schema;

export type EntDataModel = EntDataModelFromSchema<typeof schema>;

export const entDefinitions: EntDataModel = getEntDefinition(schema.tables);
