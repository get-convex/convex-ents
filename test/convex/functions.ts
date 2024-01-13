import {
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import {
  internalMutation as baseInternalMutation,
  internalQuery as baseInternalQuery,
  mutation as baseMutation,
  query as baseQuery,
} from "./_generated/server";
import { mutationCtxWithRules, queryCtxWithRules } from "./rules";

export const query = customQuery(
  baseQuery,
  customCtx(async (ctx) => {
    return await queryCtxWithRules(ctx);
  })
);

export const internalQuery = customQuery(
  baseInternalQuery,
  customCtx(async (ctx) => {
    return await queryCtxWithRules(ctx);
  })
);

export const mutation = customMutation(
  baseMutation,
  customCtx(async (ctx) => {
    return await mutationCtxWithRules(ctx);
  })
);

export const internalMutation = customMutation(
  baseInternalMutation,
  customCtx(async (ctx) => {
    return await mutationCtxWithRules(ctx);
  })
);
