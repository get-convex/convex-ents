import { mutation, query } from "./functions";

export function testSuite() {
  let SETUP: Parameters<typeof mutation>[0] = async () => {};
  const TESTS: { name: string; fn: (ctx: any) => any }[] = [];

  const clear = mutation(async (ctx) => {
    for (const table of [
      "users",
      "messages",
      "profiles",
      "tags",
      "posts",
    ] as const) {
      await ctx.table(table).map((doc) => doc.delete());
    }
  });

  const run = {
    setup: async (ctx: any) => {
      await clear(ctx, {});
      await (SETUP as any)(ctx);
    },
    tests: async (ctx: any) => {
      for (const { name, fn } of TESTS) {
        try {
          await fn(ctx);
        } catch (error) {
          console.error(name);
          throw error;
        }
      }
    },
    teardown: async (ctx: any) => {
      await clear(ctx, {});
    },
  };
  return {
    setup: (...fn: Parameters<typeof mutation>) => {
      SETUP = fn[0];
    },
    // Change this from `typeof mutation` to `typeof query`
    // to test the read-only types.
    test: (name: string, ...fn: Parameters<typeof mutation>) => {
      TESTS.push({ name, fn: fn[0] as any });
    },
    run,
    runTests: mutation(async (ctx: any): Promise<void> => {
      for (const { name, fn } of TESTS) {
        await clear(ctx, {});
        await (SETUP as any)(ctx);
        try {
          await fn(ctx);
        } catch (error) {
          console.error(name);
          throw error;
        }
        await clear(ctx, {});
      }
    }),
  };
}
