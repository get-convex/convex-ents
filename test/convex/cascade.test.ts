import { expect, test, vi } from "vitest";
import schema from "./schema";
import { convexTest, runCtx } from "./setup.testing";

test("scheduled delete", async () => {
  vi.useFakeTimers();

  const t = convexTest(schema);
  await t.run(async (baseCtx) => {
    const ctx = await runCtx(baseCtx);

    await ctx.table("teams").insert({});
    const teamId = await ctx.table("teams").insert({});
    const memberId = await ctx.table("members").insert({ teamId });
    const dataId = await ctx.table("datas").insert({ memberId });
    const badgeId = await ctx.table("badges").insert({ memberId });
    await ctx.table("teams").getX(teamId).delete();
    const softDeletedTeam = await ctx.table("teams").getX(teamId);
    expect(softDeletedTeam.deletionTime).not.toBeUndefined();
    const softDeletedMember = await ctx.table("members").getX(memberId);
    expect(softDeletedMember.deletionTime).not.toBeUndefined();
    expect(await ctx.table("datas").getX(dataId)).not.toBeNull();
    expect(await ctx.table("badges").getX(badgeId)).not.toBeNull();
  });

  await t.finishAllScheduledFunctions(vi.runAllTimers);

  await t.run(async (baseCtx) => {
    const ctx = await runCtx(baseCtx);
    const teams = await ctx.table("teams");
    expect(teams.length).toBe(1);
    const members = await ctx.table("members");
    expect(members.length).toBe(0);
    const datas = await ctx.table("datas");
    expect(datas.length).toBe(0);
    const badges = await ctx.table("badges");
    expect(badges.length).toBe(0);
  });

  vi.useRealTimers();
});

test("don't cascade across optional 1:1 edge", async () => {
  const t = convexTest(schema);
  await t.run(async (baseCtx) => {
    const ctx = await runCtx(baseCtx);

    const userId = await ctx.table("users").insert({
      name: "Gates",
      email: "bill@gates.com",
    });
    const photoId = await ctx
      .table("photos")
      .insert({ url: "https://a.b", ownerId: userId });

    await ctx.table("users").getX(userId).delete();

    const notDeletedPhoto = await ctx.table("photos").get(photoId);
    expect(notDeletedPhoto).not.toBeNull();
  });
});

test("cascade across optional 1:1 edge when configured", async () => {
  const t = convexTest(schema);
  await t.run(async (baseCtx) => {
    const ctx = await runCtx(baseCtx);

    const userId = await ctx.table("users").insert({
      name: "Gates",
      email: "bill@gates.com",
    });
    const photoId = await ctx
      .table("photos")
      .insert({ url: "https://a.b", userId });

    await ctx.table("users").getX(userId).delete();

    const deletedPhoto = await ctx.table("photos").get(photoId);
    expect(deletedPhoto).toBeNull();
  });
});
