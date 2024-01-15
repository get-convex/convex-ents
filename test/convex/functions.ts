import {
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import { entsTableFactory } from "../../src";
import {
  MutationCtx,
  QueryCtx,
  internalMutation as baseInternalMutation,
  internalQuery as baseInternalQuery,
  mutation as baseMutation,
  query as baseQuery,
} from "./_generated/server";
import { getEntDefinitionsWithRules, getViewer } from "./rules";
import { entDefinitions } from "./schema";

export const query = customQuery(
  baseQuery,
  customCtx(async (baseCtx) => {
    return await queryCtx(baseCtx);
  })
);

export const internalQuery = customQuery(
  baseInternalQuery,
  customCtx(async (baseCtx) => {
    return await queryCtx(baseCtx);
  })
);

export const mutation = customMutation(
  baseMutation,
  customCtx(async (baseCtx) => {
    return await mutationCtx(baseCtx);
  })
);

export const internalMutation = customMutation(
  baseInternalMutation,
  customCtx(async (baseCtx) => {
    return await mutationCtx(baseCtx);
  })
);

async function queryCtx(baseCtx: QueryCtx) {
  const ctx = {
    db: baseCtx.db as unknown as undefined,
    skipRules: { table: entsTableFactory(baseCtx.db, entDefinitions) },
  };
  const entDefinitionsWithRules = getEntDefinitionsWithRules(ctx as any);
  const viewerNoRules = await getViewer({ ...baseCtx, ...ctx });
  (ctx as any).viewer = viewerNoRules;
  const table = entsTableFactory(baseCtx.db, entDefinitionsWithRules);
  (ctx as any).table = table;
  const viewer =
    viewerNoRules !== null ? await table("users").get(viewerNoRules._id) : null;
  (ctx as any).viewer = viewer;
  return { ...ctx, table, viewer };
}

async function mutationCtx(baseCtx: MutationCtx) {
  const ctx = {
    db: baseCtx.db as unknown as undefined,
    skipRules: { table: entsTableFactory(baseCtx.db, entDefinitions) },
  };
  const entDefinitionsWithRules = getEntDefinitionsWithRules(ctx as any);
  const viewerNoRules = await getViewer({ ...baseCtx, ...ctx });
  (ctx as any).viewer = viewerNoRules;
  const table = entsTableFactory(baseCtx.db, entDefinitionsWithRules);
  (ctx as any).table = table;
  const viewer =
    viewerNoRules !== null ? await table("users").get(viewerNoRules._id) : null;
  (ctx as any).viewer = viewer;
  return { ...ctx, table, viewer };
}
