import { expect, test } from "vitest";
import type { Infer } from "convex/values";
import schema from "./schema";
import { MutationCtx, QueryCtx } from "./types";

// Check that MutationCtx extends QueryCtx
export function mutable(ctx: MutationCtx) {
  function immutable(ctx: QueryCtx) {
    return ctx.table("users").firstX();
  }

  return immutable(ctx);
}

test("placeholder", async () => {
  expect(true).toBeTruthy();
});

const emailArgs = schema.tables.users.validator.pick("email");

type EmailArgs = Infer<typeof emailArgs>;

test("field validators are derivable via pick", async () => {
  const args: EmailArgs = { email: "ada@example.com" };
  expect(Object.keys(emailArgs.fields)).toEqual(["email"]);
  expect(args.email).toBe("ada@example.com");
});
