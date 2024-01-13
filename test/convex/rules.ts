import {
  addEntRules,
  entsTableFactory,
  entsTableWriterFactory,
} from "../../src";
import { MutationCtx, QueryCtx } from "./_generated/server";
import { entDefinitions } from "./schema";

export async function mutationCtxWithRules(baseCtx: MutationCtx) {
  const { ctx, entDefinitionsWithRules } = await queryCtxWithRules(baseCtx);
  return {
    db: undefined,
    viewer: ctx.viewer,
    skipRules: { table: entsTableWriterFactory(baseCtx, entDefinitions) },
    table: entsTableWriterFactory(baseCtx, entDefinitionsWithRules),
  };
}

export async function queryCtxWithRules(baseCtx: QueryCtx) {
  const ctx = await queryCtxWithViewer(baseCtx);
  const entDefinitionsWithRules = getEntDefinitionsWithRules(ctx);
  // Here we make sure that the rules also apply when they're evaluated
  ctx.table = entsTableFactory(baseCtx, entDefinitionsWithRules);
  return { ctx, entDefinitionsWithRules };
}

async function queryCtxWithViewer(baseCtx: QueryCtx) {
  const ctx = queryCtxForLoadingViewer(baseCtx);
  const viewer = await getViewer(ctx);
  return {
    ...ctx,
    viewer,
    // This one is here just for its type, and won't be used at runtime
    table: entsTableFactory(baseCtx, entDefinitions),
  };
}

function getEntDefinitionsWithRules(
  ctx: Awaited<ReturnType<typeof queryCtxWithViewer>>
) {
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

function queryCtxForLoadingViewer(baseCtx: QueryCtx) {
  return {
    ...baseCtx,
    db: undefined,
    skipRules: { table: entsTableFactory(baseCtx, entDefinitions) },
  };
}

async function getViewer(ctx: ReturnType<typeof queryCtxForLoadingViewer>) {
  // TODO: Implement me via `ctx.skipRules.table()`
  return ctx.skipRules.table("users").first();
}
