import { addEntRules } from "../../src";
import { entDefinitions } from "./schema";
import { Ent, QueryCtx } from "./types";

export function getEntDefinitionsWithRules(
  ctx: QueryCtx
): typeof entDefinitions {
  return addEntRules(entDefinitions, {
    secrets: {
      read: async (secret) => {
        return ctx.viewer?._id === secret.ownerId;
      },
      write: async ({ operation, ent: secret, value }) => {
        if (operation === "delete") {
          return false;
        }
        if (operation === "create") {
          return ctx.viewer?._id === value.ownerId;
        }
        return value.ownerId === undefined || value.ownerId === secret.ownerId;
      },
    },
  });
}

export async function getViewer(
  ctx: Omit<QueryCtx, "table" | "viewer">
): Promise<Ent<"users"> | null> {
  // TODO: Implement me via `ctx.skipRules.table()`
  return await ctx.skipRules.table("users").first();
}
