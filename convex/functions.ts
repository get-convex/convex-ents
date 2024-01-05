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
} from "./_generated/server";
import { entsReaderFactory, entsWriterFactory } from "./ents/functions";
import { entDefinitions } from "./schema";

export const query = customQuery(
  baseQuery,
  customCtx(async (ctx) => {
    return {
      table: entsReaderFactory(ctx, entDefinitions),
      db: ctx.db as unknown as undefined,
    };
  })
);

export const internalQuery = customQuery(
  baseInternalQuery,
  customCtx(async (ctx) => {
    return {
      table: entsReaderFactory(ctx, entDefinitions),
      db: ctx.db as unknown as undefined,
    };
  })
);

export const mutation = customMutation(
  baseMutation,
  customCtx(async (ctx) => {
    return {
      table: entsWriterFactory(ctx, entDefinitions),
      db: ctx.db as unknown as undefined,
    };
  })
);

export const internalMutation = customMutation(
  baseInternalMutation,
  customCtx(async (ctx) => {
    return {
      table: entsWriterFactory(ctx, entDefinitions),
      db: ctx.db as unknown as undefined,
    };
  })
);
