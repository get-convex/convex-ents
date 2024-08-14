import {
  customAction,
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import {
  entsTableFactory,
  scheduledDeleteFactory,
  entsActionReadFactory,
  entsActionWriteFactory,
} from "../../src";
import {
  MutationCtx,
  QueryCtx,
  ActionCtx,
  internalMutation as baseInternalMutation,
  internalQuery as baseInternalQuery,
  internalAction as baseInternalAction,
  mutation as baseMutation,
  action as baseAction,
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

export const action = customAction(
  baseAction,
  customCtx(async (baseCtx) => {
    return await actionCtx(baseCtx);
  }),
);

export const internalAction = customAction(
  baseInternalAction,
  customCtx(async (baseCtx) => {
    return await actionCtx(baseCtx);
  }),
);

export const read = internalQuery(entsActionReadFactory);

export const write = internalMutation(entsActionWriteFactory);

async function queryCtx(baseCtx: QueryCtx) {
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

export async function actionCtx(baseCtx: ActionCtx) {
  return { table: entsTableFactory(baseCtx, entDefinitions) };
}

export const scheduledDelete = scheduledDeleteFactory(entDefinitions);
