import { addEntRules, entsTableFactory } from "../../src";
import { QueryCtx } from "./_generated/server";
import { entDefinitions } from "./schema";

export async function ctxProperties<Ctx extends QueryCtx>(ctx: Ctx) {
  const baseCtx = await ctxWithoutRules(ctx);
  return {
    viewer: baseCtx.viewer,
    entDefinitions: getEntDefinitionsWithRules(baseCtx),
  };
}

async function ctxWithoutRules(baseCtx: QueryCtx) {
  const ctx = ctxForLoadingViewer(baseCtx);
  const viewer = await getViewer(ctx);
  return { ...ctx, viewer };
}

function getEntDefinitionsWithRules(
  ctx: Awaited<ReturnType<typeof ctxWithoutRules>>
) {
  return addEntRules(entDefinitions, {
    secrets: {
      read: async (secret) => {
        return ctx.viewer?._id === secret.userId;
      },
      write: async (secret, changes) => {
        if (changes === undefined) {
          return false;
        }
        if (secret === undefined) {
          return ctx.viewer?._id === changes.userId;
        }
        return changes.userId === undefined || changes.userId === secret.userId;
      },
    },
  });
}

function ctxForLoadingViewer(baseCtx: QueryCtx) {
  return {
    ...baseCtx,
    table: entsTableFactory(baseCtx, entDefinitions),
    db: undefined,
  };
}

async function getViewer(ctx: ReturnType<typeof ctxForLoadingViewer>) {
  // TODO: Implement me
  return ctx.table("users").first();
}
