import { convexTest as baseConvexTest } from "convex-test";
import { SchemaDefinition, StorageActionWriter } from "convex/server";
import { EntDefinition } from "../../src";
import { MutationCtx } from "./_generated/server";
import { mutationCtx } from "./functions";

// Work around a TypeScript subtyping issue with Ents schemas
type GenericEntSchema = Record<string, EntDefinition>;
export function convexTest<Schema extends GenericEntSchema>(
  schema: SchemaDefinition<Schema, boolean>,
) {
  return baseConvexTest(schema);
}

// Use inside t.run() to use Ents
export async function runCtx(
  ctx: MutationCtx & { storage: StorageActionWriter },
) {
  return { ...ctx, ...(await mutationCtx(ctx)) };
}

export async function getNewFileId(ctx: { storage: StorageActionWriter }) {
  const bytes = new Uint8Array([0b00001100, 0b00000000]).buffer;
  return await ctx.storage.store(new Blob([bytes]));
}
