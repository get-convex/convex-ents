import { v } from "convex/values";
import { defineEnt, defineEntSchema, getEntDefinitions } from "../../src";

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
      .field("email", v.string(), { unique: true })
      .field("height", v.optional(v.number()), { index: true })
      .edge("profile", { optional: true })
      .edges("messages")
      .edges("followers", { to: "users", inverse: "followees" })
      .edges("friends", { to: "users" })
      .edge("secret", { ref: "ownerId", optional: true }),

    profiles: defineEnt({
      bio: v.string(),
    }).edge("user"),

    tags: defineEnt({
      name: v.string(),
    }).edges("messages"),

    posts: defineEnt({
      text: v.string(),
    })
      .field("numLikes", v.number(), { default: 0 })
      .field("type", v.union(v.literal("text"), v.literal("video")), {
        default: "text",
      })
      .index("numLikesAndType", ["type", "numLikes"])
      .searchIndex("text", {
        searchField: "text",
        filterFields: ["type"],
      })
      .edge("attachment", { ref: "originId", optional: true })
      .edge("secondaryAttachment", {
        ref: "copyId",
        to: "attachments",
        optional: true,
      })
      .edges("allAttachments", { to: "attachments", ref: "shareId" }),

    attachments: defineEnt({})
      .edge("origin", { to: "posts", field: "originId" })
      .edge("copy", { to: "posts", field: "copyId" })
      .edge("share", { to: "posts", field: "shareId" }),

    secrets: defineEnt({
      value: v.string(),
    }).edge("user", { field: "ownerId" }),
  },
  { schemaValidation: true }
);

export default schema;

export const entDefinitions = getEntDefinitions(schema);
