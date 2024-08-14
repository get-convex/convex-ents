import { test as baseTest, expect, vi } from "vitest";
import { actionCtx } from "./functions";
import schema from "./schema";
import { convexTest } from "./setup.testing";
import { ActionCtx } from "./types";
import { internal } from "./_generated/api";

// To test typechecking, replace MutationCtx with QueryCtx
const test = baseTest.extend<{ ctx: ActionCtx }>({
  // eslint-disable-next-line no-empty-pattern
  ctx: async ({}, use) => {
    const t = convexTest(schema);
    await (t as any).act(async (ctx: any) => {
      await use({ ...ctx, ...((await actionCtx(ctx)) as any) });
    });
  },
});

test("normalize id", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com", height: 3 });
  const normalizedId = await ctx.table("users").normalizeId(userId);
  expect(normalizedId).toEqual(userId);
  const normalizedId2 = await ctx.table("users").normalizeIdX(userId);
  expect(normalizedId2).toEqual(userId);
  const normalizedIdBad = await ctx.table("users").normalizeId("foo");
  expect(normalizedIdBad).toBeNull();
  await expect(async () => {
    await ctx.table("users").normalizeIdX("foo");
  }).rejects.toThrowError();
});

test("get id", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com", height: 3 });
  const user = await ctx.table("users").get(userId);
  expect(user).toMatchObject({
    _id: userId,
    name: "Stark",
    email: "tony@stark.com",
    height: 3,
  });
  const userX = await ctx.table("users").getX(userId);
  expect(userX).toMatchObject({
    _id: userId,
    name: "Stark",
    email: "tony@stark.com",
    height: 3,
  });

  await ctx.table("users").getX(userId).delete();

  const userBad = await ctx.table("users").get(userId);
  expect(userBad).toBeNull();
  await expect(async () => {
    await ctx.table("users").getX(userId);
  }).rejects.toThrowError();
});

test("get via index", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com", height: 3 });
  const user = await ctx.table("users").get("email", "tony@stark.com");
  expect(user).toMatchObject({
    _id: userId,
    name: "Stark",
    email: "tony@stark.com",
    height: 3,
  });
  const userX = await ctx.table("users").getX("email", "tony@stark.com");
  expect(userX).toMatchObject({
    _id: userId,
    name: "Stark",
    email: "tony@stark.com",
    height: 3,
  });

  await ctx.table("users").getX("email", "tony@stark.com").delete();

  const userBad = await ctx.table("users").get("email", "tony@stark.com");
  expect(userBad).toBeNull();
  await expect(async () => {
    await ctx.table("users").getX("email", "tony@stark.com");
  }).rejects.toThrowError();
});

test("getMany", async ({ ctx }) => {
  await ctx.table("users").insertMany([
    { name: "Stark", email: "tony@stark.com", height: 3 },
    { name: "Musk", email: "elon@musk.com" },
  ]);
  const users = await ctx.table("users");
  const specificUsers = await ctx
    .table("users")
    .getMany([users[0]._id, users[1]._id]);
  expect(specificUsers).toMatchObject([{ name: "Stark" }, { name: "Musk" }]);
  const specificUsersX = await ctx
    .table("users")
    .getManyX([users[0]._id, users[1]._id]);
  expect(specificUsersX).toMatchObject([{ name: "Stark" }, { name: "Musk" }]);

  await ctx.table("users").getX(users[0]._id).delete();

  const withNulls = await ctx
    .table("users")
    .getMany([users[0]._id, users[1]._id]);

  expect(withNulls).toMatchObject([null, { name: "Musk" }]);

  await expect(async () => {
    await ctx.table("users").getManyX([users[0]._id, users[1]._id]);
  }).rejects.toThrowError();
});

test("table collect", async ({ ctx }) => {
  await ctx.table("users").insertMany([
    { name: "Stark", email: "tony@stark.com", height: 3 },
    { name: "Musk", email: "elon@musk.com" },
  ]);

  const users = await ctx.table("users");
  expect(users).toMatchObject([
    { name: "Stark", email: "tony@stark.com", height: 3 },
    { name: "Musk", email: "elon@musk.com" },
  ]);
});

test("index filter", async ({ ctx }) => {
  await ctx.table("users").insertMany([
    { name: "Stark", email: "tony@stark.com", height: 3 },
    { name: "Musk", email: "elon@musk.com" },
  ]);

  const users = await ctx.table("users", "height", (q) => q.eq("height", 3));
  expect(users).toMatchObject([
    { name: "Stark", email: "tony@stark.com", height: 3 },
  ]);
  const usersWithoutField = await ctx.table("users", "height", (q) =>
    q.eq("height", undefined),
  );
  expect(usersWithoutField).toMatchObject([
    { name: "Musk", email: "elon@musk.com" },
  ]);
});

test("text search", async ({ ctx }) => {
  await ctx
    .table("posts")
    .insertMany([
      { text: "My great post" } as any,
      { text: "My bad post" } as any,
    ]);
  const posts = await ctx
    .table("posts")
    .search("text", (q) => q.search("text", "great"));
  expect(posts).toMatchObject([{ text: "My great post" }]);
});

test("filter", async ({ ctx }) => {
  await ctx.table("users").insertMany([
    { name: "Stark", email: "tony@stark.com", height: 3 },
    { name: "Musk", email: "elon@musk.com" },
  ]);

  const users = await ctx
    .table("users")
    .filter((q) => q.eq(q.field("height"), 3));
  expect(users).toMatchObject([
    { name: "Stark", email: "tony@stark.com", height: 3 },
  ]);

  const usersWithoutField = await ctx
    .table("users")
    .filter((q) => q.eq(q.field("height"), undefined));
  expect(usersWithoutField).toMatchObject([
    { name: "Musk", email: "elon@musk.com" },
  ]);
});

test("order", async ({ ctx }) => {
  await ctx.table("users").insertMany([
    { name: "Stark", email: "tony@stark.com", height: 3 },
    { name: "Musk", email: "elon@musk.com" },
  ]);

  const users = await ctx.table("users").order("desc");
  expect(users).toMatchObject([
    { name: "Musk", email: "elon@musk.com" },
    { name: "Stark", email: "tony@stark.com", height: 3 },
  ]);
});

test("order by index", async ({ ctx }) => {
  await ctx.table("users").insertMany([
    { name: "Stark", email: "tony@stark.com", height: 3 },
    { name: "Musk", email: "elon@musk.com", height: 7 },
    { name: "Gates", email: "bill@gates.com", height: 2 },
  ]);

  const users = await ctx.table("users").order("desc", "height");
  expect(users).toMatchObject([
    { name: "Musk", email: "elon@musk.com", height: 7 },
    { name: "Stark", email: "tony@stark.com", height: 3 },
    { name: "Gates", email: "bill@gates.com", height: 2 },
  ]);
});

test("take", async ({ ctx }) => {
  await ctx.table("users").insertMany([
    { name: "Stark", email: "tony@stark.com", height: 3 },
    { name: "Musk", email: "elon@musk.com" },
  ]);

  const users = await ctx.table("users").take(1);
  expect(users).toMatchObject([
    { name: "Stark", email: "tony@stark.com", height: 3 },
  ]);
});

test("paginate", async ({ ctx }) => {
  await ctx.table("users").insertMany([
    { name: "Stark", email: "tony@stark.com", height: 3 },
    { name: "Musk", email: "elon@musk.com" },
    { name: "Gates", email: "bill@gates.com", height: 2 },
  ]);

  const users = await ctx
    .table("users")
    .paginate({ cursor: null, numItems: 2 });
  expect(users.page).toMatchObject([
    { name: "Stark", email: "tony@stark.com", height: 3 },
    { name: "Musk", email: "elon@musk.com" },
  ]);
  expect(users.isDone).toBe(false);

  const usersRest = await ctx
    .table("users")
    .paginate({ cursor: users.continueCursor, numItems: 2 });
  expect(usersRest.page).toMatchObject([
    { name: "Gates", email: "bill@gates.com", height: 2 },
  ]);
  expect(usersRest.isDone).toBe(true);
});

test("first", async ({ ctx }) => {
  expect(await ctx.table("users").first()).toBeNull();
  await expect(async () => {
    await ctx.table("users").firstX();
  }).rejects.toThrowError();

  await ctx.table("users").insertMany([
    { name: "Stark", email: "tony@stark.com", height: 3 },
    { name: "Musk", email: "elon@musk.com" },
  ]);

  const user = await ctx.table("users").first();
  expect(user).toMatchObject({
    name: "Stark",
    email: "tony@stark.com",
    height: 3,
  });

  const userX = await ctx.table("users").firstX();
  expect(userX).toMatchObject({
    name: "Stark",
    email: "tony@stark.com",
    height: 3,
  });
});

test("unique", async ({ ctx }) => {
  // 0
  expect(await ctx.table("users").unique()).toBeNull();
  await expect(async () => {
    await ctx.table("users").uniqueX();
  }).rejects.toThrowError();

  await ctx.table("users").insert({ name: "Stark", email: "tony@stark.com" });

  // 1
  const user = await ctx.table("users").unique();
  expect(user).toMatchObject({ name: "Stark", email: "tony@stark.com" });

  const userX = await ctx.table("users").uniqueX();
  expect(userX).toMatchObject({ name: "Stark", email: "tony@stark.com" });

  await ctx.table("users").insert({ name: "Musk", email: "elon@musk.com" });

  // 2
  await expect(async () => {
    await ctx.table("users").unique();
  }).rejects.toThrowError();
  await expect(async () => {
    await ctx.table("users").uniqueX();
  }).rejects.toThrowError();
});

test("_storage", async ({ ctx }) => {
  const files = await ctx.table.system("_storage");
  expect(files).toHaveLength(0);
});

test("_scheduled_functions get", async ({ ctx }) => {
  vi.useFakeTimers();

  const id = await ctx.scheduler.runAfter(
    10000,
    internal.migrations.usersCapitalizeName,
    { fn: "Foo" },
  );

  const scheduled = await ctx.table.system("_scheduled_functions").get(id);
  expect(scheduled).not.toBeNull();

  await ctx.scheduler.cancel(id);

  vi.useRealTimers();
});

test("1:1 edge", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" });

  expect(await ctx.table("users").getX(userId).edge("profile")).toBeNull();

  const profileId = await ctx
    .table("profiles")
    .insert({ bio: "Hello world", userId });

  const user = await ctx.table("profiles").getX(profileId).edge("user");
  expect(user).toMatchObject({ name: "Stark", email: "tony@stark.com" });

  const profile = await ctx.table("users").getX(userId).edge("profile");
  expect(profile).toMatchObject({ bio: "Hello world", userId });
});

test("1:many edge", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" });

  expect(await ctx.table("users").getX(userId).edge("messages")).toMatchObject(
    [],
  );

  await ctx.table("messages").insert({ text: "Hello world", userId });

  const messages = await ctx.table("users").getX(userId).edge("messages");
  expect(messages).toMatchObject([{ text: "Hello world", userId }]);
});

test("many:many edge", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" });
  const messageId = await ctx
    .table("messages")
    .insert({ text: "Hello world", userId });

  expect(
    await ctx.table("messages").getX(messageId).edge("tags"),
  ).toMatchObject([]);

  await ctx.table("tags").insert({ name: "cool", messages: [messageId] });

  const tags = await ctx.table("messages").getX(messageId).edge("tags");
  expect(tags).toMatchObject([{ name: "cool" }]);

  const messages = await ctx.table("tags").getX(tags[0]._id).edge("messages");
  expect(messages).toMatchObject([{ text: "Hello world", userId }]);
});

test("patch", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" });

  const userId2 = await ctx.table("users").getX(userId).patch({ name: "Tom" });

  expect(userId).toEqual(userId2);

  const user = await ctx.table("users").getX(userId);
  expect(user).toMatchObject({ name: "Tom", email: "tony@stark.com" });

  const user2 = await ctx
    .table("users")
    .getX(userId)
    .patch({ name: "Mike" })
    .get();
  expect(user2).toMatchObject({ name: "Mike", email: "tony@stark.com" });
});

test("replace", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" });

  const userId2 = await ctx
    .table("users")
    .getX(userId)
    .replace({ name: "Tom", email: "foo" });

  expect(userId).toEqual(userId2);

  const user = await ctx.table("users").getX(userId);
  expect(user).toMatchObject({ name: "Tom", email: "foo" });

  const user2 = await ctx
    .table("users")
    .getX(userId)
    .replace({ name: "Mike", email: "bar" })
    .get();
  expect(user2).toMatchObject({ name: "Mike", email: "bar" });
});
