import { FunctionReference } from "convex/server";
import { ActionCtx } from "./_generated/server";
import { mutation, query } from "./functions";
import { Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./types";

export function testSuite() {
  let SETUP: Parameters<typeof mutation>[0] = async () => {};
  const TESTS: Record<string, (ctx: any) => any> = {};
  const ONLY_TESTS: Record<string, (ctx: any) => any> = {};
  function getTests() {
    return Object.keys(ONLY_TESTS).length > 0 ? ONLY_TESTS : TESTS;
  }

  const TABLES = [
    "users",
    "messages",
    "profiles",
    "tags",
    "posts",
    "secrets",
  ] as const;

  const clear = async (
    ctx: MutationCtx,
    except?: Record<string, Id<any>[]>
  ) => {
    for (const table of TABLES) {
      const exceptIdSet = new Set((except ?? {})[table] || []);
      await ctx.skipRules.table(table).map(async (doc) => {
        if (!exceptIdSet.has(doc._id)) {
          await doc.delete();
        }
      });
    }
  };

  async function snapshotSetup(ctx: QueryCtx) {
    const snapshot: Record<string, Id<any>[]> = {};
    for (const table of TABLES) {
      snapshot[table] = await ctx.skipRules
        .table(table)
        .map((doc: any) => doc._id);
    }
    return snapshot;
  }

  return {
    setup: (...fn: Parameters<typeof mutation>) => {
      SETUP = fn[0];
    },
    // Change this from `typeof mutation` to `typeof query`
    // to test the read-only types.
    test: (name: string, ...fn: Parameters<typeof mutation>) => {
      TESTS[name] = fn[0] as any;
    },
    testOnly: (name: string, ...fn: Parameters<typeof mutation>) => {
      ONLY_TESTS[name] = fn[0] as any;
    },
    query: query(async (ctx) => {
      for (const [name, fn] of Object.entries(getTests())) {
        try {
          await fn(ctx);
        } catch (error) {
          console.error(`Failed test "${name}"`);
          throw error;
        }
      }
    }),
    mutation: mutation(async (ctx, { name }) => {
      if (name === "setup") {
        await clear(ctx);
        await (SETUP as any)(ctx);
        return;
      } else if (name === "teardown") {
        await clear(ctx);
        return;
      }
      const snapshot = await snapshotSetup(ctx as any);
      for (const [testName, fn] of Object.entries(getTests())) {
        try {
          await fn(ctx);
          if (name === "clearAfterEach") {
            await clear(ctx, snapshot);
          }
        } catch (error) {
          console.error(`Failed test "${testName}"`);
          throw error;
        }
      }
    }),
    runner: async (
      ctx: ActionCtx,
      {
        query,
        mutation,
      }: {
        query?: FunctionReference<"query">;
        mutation: FunctionReference<"mutation">;
      }
    ) => {
      await ctx.runMutation(mutation, { name: "setup" });
      if (query !== undefined) {
        try {
          await ctx.runQuery(query);
        } catch (error) {
          console.error("Ran as !query!");
          throw error;
        }
        try {
          await ctx.runMutation(mutation);
        } catch (error) {
          console.error("Ran as !mutation!");
          throw error;
        }
      } else {
        await ctx.runMutation(mutation, { name: "clearAfterEach" });
      }
      await ctx.runMutation(mutation, { name: "teardown" });
    },
  };
}
