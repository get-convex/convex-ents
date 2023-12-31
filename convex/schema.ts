import { v } from "convex/values";
import { defineEnt, defineEntSchema, getEntDefinitions } from "./ents/schema";

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
      .edges("followers", { to: "users", inverse: "followees" })
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

export const entDefinitions = getEntDefinitions(schema);
