import { expect, test } from "vitest";
import { convexTest, runCtx } from "./testSetup";
import schema from "./schema";

test("index field", async () => {
  const t = convexTest(schema);
  await t.run(async (baseCtx) => {
    const ctx = await runCtx(baseCtx);
    await ctx.table("users").insertMany([
      { name: "Stark", email: "tony@stark.com", height: 3 },
      { name: "Musk", email: "elon@musk.com" },
    ]);
    const userByHeight = await ctx.table("users").getX("height", 3);
    expect(userByHeight.name).toEqual("Stark");
  });
});

test("default fields", async () => {
  const t = convexTest(schema);
  await t.run(async (baseCtx) => {
    const ctx = await runCtx(baseCtx);
    await ctx.table("posts").insert({ text: "My great post" } as any);
    const firstPost = await ctx.table("posts").firstX();
    expect(firstPost.numLikes).toEqual(0);
    expect(firstPost.type).toEqual("text");
  });
});
