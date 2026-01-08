import {
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import { entsTableFactory, scheduledDeleteFactory } from "../../src";
import {
  MutationCtx,
  QueryCtx,
  internalMutation as baseInternalMutation,
  internalQuery as baseInternalQuery,
  mutation as baseMutation,
  query as baseQuery,
} from "./_generated/server";
import { getEntDefinitionsWithRules, getViewerId } from "./rules";
import { entDefinitions } from "./schema";

export const query = customQuery(
  baseQuery,
  customCtx(async (baseCtx) => {
    return await queryCtx(baseCtx);
  }),
);

export const internalQuery = customQuery(
  baseInternalQuery,
  customCtx(async (baseCtx) => {
    return await queryCtx(baseCtx);
  }),
);

export const mutation = customMutation(
  baseMutation,
  customCtx(async (baseCtx) => {
    return await mutationCtx(baseCtx);
  }),
);

export const internalMutation = customMutation(
  baseInternalMutation,
  customCtx(async (baseCtx) => {
    return await mutationCtx(baseCtx);
  }),
);

async function queryCtx(baseCtx: QueryCtx) {
  deprecateOldDBReadAPIs(baseCtx);
  const ctx = {
    db: baseCtx.db as unknown as undefined,
    skipRules: { table: entsTableFactory(baseCtx, entDefinitions) },
  };
  const entDefinitionsWithRules = getEntDefinitionsWithRules(ctx as any);
  const viewerId = await getViewerId({ ...baseCtx, ...ctx });
  (ctx as any).viewerId = viewerId;
  const table = entsTableFactory(baseCtx, entDefinitionsWithRules);
  (ctx as any).table = table;
  const viewer = async () =>
    viewerId !== null ? await table("users").get(viewerId) : null;
  (ctx as any).viewer = viewer;
  const viewerX = async () => {
    const ent = await viewer();
    if (ent === null) {
      throw new Error("Expected authenticated viewer");
    }
    return ent;
  };
  (ctx as any).viewerX = viewerX;
  return { ...ctx, table, viewer, viewerX, viewerId };
}

export async function mutationCtx(baseCtx: MutationCtx) {
  deprecateOldDBWriteAPIs(baseCtx);
  const ctx = {
    db: baseCtx.db as unknown as undefined,
    skipRules: { table: entsTableFactory(baseCtx, entDefinitions) },
  };
  const entDefinitionsWithRules = getEntDefinitionsWithRules(ctx as any);
  const viewerId = await getViewerId({ ...baseCtx, ...ctx });
  (ctx as any).viewerId = viewerId;
  const table = entsTableFactory(baseCtx, entDefinitionsWithRules);
  (ctx as any).table = table;
  const viewer = async () =>
    viewerId !== null ? await table("users").get(viewerId) : null;
  (ctx as any).viewer = viewer;
  const viewerX = async () => {
    const ent = await viewer();
    if (ent === null) {
      throw new Error("Expected authenticated viewer");
    }
    return ent;
  };
  (ctx as any).viewerX = viewerX;
  return { ...ctx, table, viewer, viewerX, viewerId };
}

function deprecateOldDBWriteAPIs(ctx: MutationCtx) {
  const patch = ctx.db.patch.bind(ctx.db);
  ctx.db.patch = ((...args: Parameters<typeof patch>) => {
    if (args.length <= 2) {
      throw new Error("Old ctx.db.patch is deprecated");
    }
    return patch(...args);
  }) as typeof patch;
  const deleteFn = ctx.db.delete.bind(ctx.db);
  ctx.db.delete = ((...args: Parameters<typeof deleteFn>) => {
    if (args.length <= 1) {
      throw new Error("Old ctx.db.delete is deprecated");
    }
    return deleteFn(...args);
  }) as typeof deleteFn;
  const replace = ctx.db.replace.bind(ctx.db);
  ctx.db.replace = ((...args: Parameters<typeof replace>) => {
    if (args.length <= 2) {
      throw new Error("Old ctx.db.replace is deprecated");
    }
    return replace(...args);
  }) as typeof replace;
}

function deprecateOldDBReadAPIs(ctx: QueryCtx) {
  const get = ctx.db.get.bind(ctx.db);
  ctx.db.get = ((...args: Parameters<typeof get>) => {
    if (args.length <= 1) {
      throw new Error("Old ctx.db.get is deprecated");
    }
    return get(...args);
  }) as typeof get;
}

export const scheduledDelete = scheduledDeleteFactory(entDefinitions);
