import expect from "@storybook/expect";
import { mutation } from "./functions";
import { testSuite } from "./testSuite";
import { api } from "./_generated/api";
import { action } from "./_generated/server";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { test, testOnly, runner, mutation: setup } = testSuite();

test("scheduled delete", async (ctx) => {
  await ctx.table("teams").insert({});
  const teamId = await ctx.table("teams").insert({});
  const memberId = await ctx.table("members").insert({ teamId });
  const dataId = await ctx.table("datas").insert({ memberId });
  await ctx.table("teams").getX(teamId).delete();
  const softDeletedTeam = await ctx.table("teams").getX(teamId);
  expect(softDeletedTeam.deletionTime).not.toBeUndefined();
  const softDeletedMember = await ctx.table("members").getX(memberId);
  expect(softDeletedMember.deletionTime).not.toBeUndefined();
  expect(await ctx.table("datas").getX(dataId)).not.toBeNull();
});

export { setup };

export const check = mutation(async (ctx) => {
  const teams = await ctx.table("teams");
  expect(teams.length).toBe(1);
  const members = await ctx.table("members");
  expect(members.length).toBe(0);
  const datas = await ctx.table("datas");
  expect(datas.length).toBe(0);
});

export const runTest = action(async (ctx) => {
  try {
    await ctx.runMutation(api.cascade.check, {});
  } finally {
    await ctx.runMutation(api.cascade.setup, { name: "teardown" });
  }
});
