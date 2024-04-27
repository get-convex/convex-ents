import { convexTest as baseConvexTest } from "convex-test";
import {
  GenericDataModel,
  GenericMutationCtx,
  SchemaDefinition,
  StorageActionWriter,
} from "convex/server";
import { EntDefinition } from "../../src";
import { mutationCtx } from "./functions";

// Work around a TypeScript subtyping issue with Ents schemas
type GenericEntSchema = Record<string, EntDefinition>;
export function convexTest<Schema extends GenericEntSchema>(
  schema: SchemaDefinition<Schema, boolean>,
) {
  return baseConvexTest(schema);
}

// Use inside t.run() to use Ents
export async function runCtx<DataModel extends GenericDataModel>(
  ctx: GenericMutationCtx<DataModel> & {
    storage: StorageActionWriter;
  },
) {
  return { ...ctx, ...(await mutationCtx(ctx)) };
}
