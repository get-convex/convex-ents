import {
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import {
  query as baseQuery,
  mutation as baseMutation,
  internalQuery as baseInternalQuery,
  internalMutation as baseInternalMutation,
  QueryCtx,
} from "./_generated/server";
import { entsTableFactory, entsTableWriterFactory } from "../../src";
import { entDefinitions } from "./schema";
// import { ctxProperties } from "./rules";

export const query = customQuery(
  baseQuery,
  customCtx(async (ctx) => {
    // const { user, entDefinitions } = await ctxProperties(ctx);
    return {
      table: entsTableFactory(ctx, entDefinitions),
      db: ctx.db as unknown as undefined,
      // user,
    };
  })
);

export const internalQuery = customQuery(
  baseInternalQuery,
  customCtx(async (ctx) => {
    return {
      table: entsTableFactory(ctx, entDefinitions),
      db: ctx.db as unknown as undefined,
    };
  })
);

export const mutation = customMutation(
  baseMutation,
  customCtx(async (ctx) => {
    return {
      table: entsTableWriterFactory(ctx, entDefinitions),
      db: ctx.db as unknown as undefined,
    };
  })
);

export const internalMutation = customMutation(
  baseInternalMutation,
  customCtx(async (ctx) => {
    return {
      table: entsTableWriterFactory(ctx, entDefinitions),
      db: ctx.db as unknown as undefined,
    };
  })
);
