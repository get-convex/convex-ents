import { entsTableFactory } from "../../src";
import { addEntRules } from "../../src/functions";
import { QueryCtx } from "./_generated/server";
import { entDefinitions } from "./schema";

export async function ctxProperties<Ctx extends QueryCtx>(ctx: Ctx) {
  const baseCtx = await ctxWithoutRules(ctx);
  return {
    viewer: baseCtx.viewer,
    entDefinitions: getEntDefinitionsWithRules(baseCtx),
  };
}

function getEntDefinitionsWithRules(
  ctx: Awaited<ReturnType<typeof ctxWithoutRules>>
) {
  return addEntRules(entDefinitions, {
    secrets: {
      read: async (secret) => {
        return ctx.viewer?._id === secret.userId;
      },
    },
  });
}

async function ctxWithoutRules(baseCtx: QueryCtx) {
  const table = entsTableFactory(baseCtx, entDefinitions);
  const viewer = await table("users").first();
  return { ...baseCtx, table, viewer, db: undefined };
}
