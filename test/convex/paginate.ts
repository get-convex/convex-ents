import expect from "@storybook/expect";
import { testSuite } from "./testSuite";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { test, testOnly, setup, runner, query, mutation } = testSuite();

setup(async (ctx) => {
  const user1 = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com", height: 3 })
    .get();
  await ctx
    .table("messages")
    .insert({ text: "Hello world", userId: user1._id })
    .get();
  await ctx.table("profiles").insert({ bio: "Hello world", userId: user1._id });
});

test("paginate with map", async (ctx) => {
  const messages = await ctx
    .table("messages")
    .paginate({ cursor: null, numItems: 1 })
    .map(async (message) => ({
      text: message.text,
      author: (await message.edge("user")).name,
    }));
  expect(messages.page).toHaveLength(1);
  expect(messages.page[0].text).toEqual("Hello world");
  expect(messages.page[0].author).toEqual("Stark");
});

export { query, mutation };

export const runTests = action(async (ctx) => {
  await runner(ctx, { query: api.read.query, mutation: api.read.mutation });
});
