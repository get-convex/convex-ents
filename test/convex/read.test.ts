import { test as baseTest, expect, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { convexTest, runCtx } from "./setup.testing";
import { Ent, EntWriter, MutationCtx } from "./types";

// To test typechecking, replace MutationCtx with QueryCtx
const test = baseTest.extend<{ ctx: MutationCtx }>({
  // eslint-disable-next-line no-empty-pattern
  ctx: async ({}, use) => {
    const t = convexTest(schema);
    await t.run(async (baseCtx) => {
      const ctx = await runCtx(baseCtx);
      await use(ctx);
    });
  },
});

test("index field", async ({ ctx }) => {
  await ctx.table("users").insertMany([
    { name: "Stark", email: "tony@stark.com", height: 3 },
    { name: "Musk", email: "elon@musk.com" },
  ]);
  const userByHeight = await ctx.table("users").getX("height", 3);
  expect(userByHeight.name).toEqual("Stark");
});

test("default fields", async ({ ctx }) => {
  await ctx.table("posts").insert({ text: "My great post" } as any);
  const firstPost = await ctx.table("posts").firstX();
  expect(firstPost.numLikes).toEqual(0);
  expect(firstPost.type).toEqual("text");
});

test("get using index", async ({ ctx }) => {
  await ctx.table("users").insertMany([
    { name: "Stark", email: "tony@stark.com", height: 3 },
    { name: "Musk", email: "elon@musk.com" },
  ]);
  const userByHeight = await ctx.table("users").getX("height", 3);
  expect(userByHeight.name).toEqual("Stark");
});

test("getX using index", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" });
  await ctx.table("messages").insert({ text: "Hello world", userId });

  const id = (await ctx.table("users").firstX())._id;
  const message = await ctx.table("messages").getX("userId", id);
  expect(message.text).toEqual("Hello world");
});

test("get using compound index", async ({ ctx }) => {
  await ctx.table("posts").insertMany([
    { text: "My great video", type: "video", numLikes: 4 },
    { text: "My awesome video", type: "video", numLikes: 0 },
  ]);
  const video = await ctx.table("posts").getX("numLikesAndType", "video", 4);
  expect(video.text).toEqual("My great video");
  expect(video.numLikes).toEqual(4);
  expect(video.type).toEqual("video");
});

test("default fields", async ({ ctx }) => {
  await ctx.table("posts").insert({ text: "My great post" } as any);
  const firstPost = await ctx.table("posts").firstX();
  expect(firstPost.numLikes).toEqual(0);
  expect(firstPost.type).toEqual("text");
});

test("1:1 edgeX from ref end, existing", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" });
  await ctx.table("profiles").insert({ bio: "Hello world", userId });
  const firstUserProfile = await ctx.table("users").firstX().edgeX("profile");
  expect(firstUserProfile.bio).toEqual("Hello world");
});

test("1:1 optional edge missing", async ({ ctx }) => {
  const photo = await ctx.table("photos").insert({ url: "https://a.b" }).get();

  const user = await photo.edge("user");
  if (false) {
    // @ts-expect-error
    user._id;
  }

  expect(user).toBeNull();
});

test("1:1 optional edge traversal", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" });
  const photo = await ctx
    .table("photos")
    .insert({ url: "https://a.b", userId })
    .get();

  const user = await photo.edge("user");
  expect(user).not.toBeNull();
  expect(user!.name).toEqual("Stark");
});

test("1:many edge from field end", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" });
  await ctx.table("messages").insert({ text: "Hello world", userId });
  const firstMessageUser = await ctx.table("messages").firstX().edge("user");
  expect(firstMessageUser.name).toEqual("Stark");
});

test("many:many symmetric edge", async ({ ctx }) => {
  const user1 = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" })
    .get();
  const user2 = await ctx
    .table("users")
    .insert({ name: "Musk", email: "elon@musk.com" })
    .get();
  await user2.patch({ friends: { add: [user1._id] } });
  const friends = await ctx.table("users").firstX().edge("friends");
  expect(friends.length).toEqual(1);
  expect(friends[0].name).toEqual("Musk");
  expect((await friends[0].edge("friends"))[0].name).toEqual("Stark");
});

test("getMany", async ({ ctx }) => {
  await ctx.table("users").insertMany([
    { name: "Stark", email: "tony@stark.com" },
    { name: "Musk", email: "elon@musk.com" },
  ]);
  const users = await ctx.table("users");
  const specificUsers = await ctx
    .table("users")
    .getMany([users[0]._id, users[1]._id]);
  expect(specificUsers).toHaveLength(2);
  expect(specificUsers[0]?.name).toEqual(users[0].name);
  expect(specificUsers[1]?.name).toEqual(users[1].name);

  await ctx.table("users").getX(users[0]._id).delete();

  const withNulls = await ctx
    .table("users")
    .getMany([users[0]._id, users[1]._id]);
  expect(withNulls).toMatchObject([null, { name: "Musk" }]);
});

test("getManyX", async ({ ctx }) => {
  await ctx.table("users").insertMany([
    { name: "Stark", email: "tony@stark.com" },
    { name: "Musk", email: "elon@musk.com" },
  ]);
  const users = await ctx.table("users");
  const specificUsers = await ctx
    .table("users")
    .getManyX([users[0]._id, users[1]._id]);
  expect(specificUsers).toHaveLength(2);
  expect(specificUsers[0]?.name).toEqual(users[0].name);
  expect(specificUsers[1]?.name).toEqual(users[1].name);
});

test("table using index", async ({ ctx }) => {
  await ctx.table("posts").insertMany([
    { text: "My great video", type: "video", numLikes: 4 },
    { text: "My awesome video", type: "video", numLikes: 0 },
  ]);
  const firstVideoWithMoreThan3Likes = await ctx
    .table("posts", "numLikesAndType", (q) =>
      q.eq("type", "video").gt("numLikes", 3),
    )
    .firstX();
  expect(firstVideoWithMoreThan3Likes.text).toEqual("My great video");
  expect(firstVideoWithMoreThan3Likes.numLikes).toEqual(4);
  expect(firstVideoWithMoreThan3Likes.type).toEqual("video");
});

test("search", async ({ ctx }) => {
  await ctx.table("posts").insertMany([
    { text: "My great video", type: "video", numLikes: 4 },
    { text: "My awesome video", type: "video", numLikes: 0 },
  ]);

  const foundPost = await ctx
    .table("posts")
    .search("text", (q) => q.search("text", "awesome").eq("type", "video"))
    .firstX();
  expect(foundPost.text).toEqual("My awesome video");
  expect(foundPost.numLikes).toEqual(0);
  expect(foundPost.type).toEqual("video");
});

test("type of ent", async ({ ctx }) => {
  const user1 = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" })
    .get();
  const user2 = await ctx
    .table("users")
    .insert({ name: "Musk", email: "elon@musk.com" })
    .get();
  await user1.patch({ followees: { add: [user2._id] } });

  const someFlag = false;
  const [firstUser, secondUser] = await ctx.table("users").take(2);

  const user = someFlag ? firstUser : secondUser;
  const usersFirstFollower = (await user.edge("followers"))[0];
  expect(usersFirstFollower).toEqual(firstUser);
});

test("map with edges", async ({ ctx }) => {
  const user1Id = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com", height: 3 });
  await ctx.table("users").insert({ name: "Musk", email: "elon@musk.com" });
  await ctx.table("messages").insert({ text: "Hello world", userId: user1Id });
  await ctx.table("profiles").insert({ bio: "Hello world", userId: user1Id });

  const usersWithMessagesAndProfile = await ctx
    .table("users")
    .map(async (user) => ({
      ...user,
      messages: await user.edge("messages"),
      profile: await user.edge("profile"),
    }));
  expect(usersWithMessagesAndProfile).toHaveLength(2);
  expect(usersWithMessagesAndProfile[0].name).toEqual("Stark");
  expect(usersWithMessagesAndProfile[0].messages.length).toEqual(1);
  expect(usersWithMessagesAndProfile[1].name).toEqual("Musk");
  expect(usersWithMessagesAndProfile[1].messages.length).toEqual(0);
  expect(Object.keys(usersWithMessagesAndProfile[0])).toEqual([
    "_creationTime",
    "_id",
    "email",
    "height",
    "name",
    "messages",
    "profile",
  ]);
  expect(usersWithMessagesAndProfile[0].profile!.bio).toEqual("Hello world");
});

test("map with nested map", async ({ ctx }) => {
  const user1Id = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com", height: 3 });
  await ctx.table("users").insert({ name: "Musk", email: "elon@musk.com" });
  await ctx.table("messages").insert({ text: "Hello world", userId: user1Id });

  const usersWithMessageTexts = await ctx.table("users").map(async (user) => ({
    name: user.name,
    email: user.email,
    messages: (await user.edge("messages")).map((message) => message.text),
  }));
  expect(usersWithMessageTexts).toEqual([
    {
      name: "Stark",
      email: "tony@stark.com",
      messages: ["Hello world"],
    },
    {
      name: "Musk",
      email: "elon@musk.com",
      messages: [],
    },
  ]);
});

test("types: Ent", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" });
  await ctx.table("messages").insert({ text: "Hello world", userId });

  const firstMessage: Ent<"messages"> = await ctx.table("messages").firstX();
  const message = { ...firstMessage };
  async () => {
    // @ts-expect-error edge should not be available on the spreaded object
    await message.edge("user");
  };
  expect(message.text).toEqual("Hello world");
});

test("types: EntWriter", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" });
  await ctx.table("messages").insert({ text: "Hello world", userId });

  const firstMessage: EntWriter<"messages"> = await ctx
    .table("messages")
    .firstX();
  const message = { ...firstMessage };
  async () => {
    // @ts-expect-error edge should not be available on the spreaded object
    await message.edge("user");
  };
  expect(message.text).toEqual("Hello world");
});

test("edge", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" });
  await ctx.table("profiles").insert({ bio: "Hello world", userId });

  const firstProfile = await ctx.table("profiles").firstX();
  const user = await firstProfile.edge("user");
  expect(user.name).toEqual("Stark");
});

test("normalizeId", async ({ ctx }) => {
  await ctx.table("users").insert({ name: "Stark", email: "tony@stark.com" });

  const foo = ctx.table("users").normalizeId("blabla");
  expect(foo).toEqual(null);
  const id = (await ctx.table("users").firstX())._id;
  const idToo = ctx.table("users").normalizeId(id);
  expect(id).toEqual(idToo);
});

test("paginate", async ({ ctx }) => {
  await ctx.table("users").insertMany([
    { name: "Stark", email: "tony@stark.com", height: 3 },
    { name: "Musk", email: "elon@musk.com" },
  ]);

  const paginatedUsersByEmail = await ctx
    .table("users")
    .order("asc", "email")
    .paginate({ cursor: null, numItems: 5 });
  expect(paginatedUsersByEmail.page[0].name).toEqual("Musk");
  expect(paginatedUsersByEmail.page[1].name).toEqual("Stark");
});

test("edge after edge", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" });
  await ctx.table("messages").insert({ text: "Hello world", userId });

  const lastMessageAuthorsMessages = await ctx
    .table("messages")
    .order("desc")
    .firstX()
    .edge("user")
    .edge("messages");
  expect(lastMessageAuthorsMessages.length).toEqual(1);
  expect(lastMessageAuthorsMessages[0].text).toEqual("Hello world");
});

test("edge after getX using index", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" });
  await ctx.table("messages").insert({ text: "Hello world", userId });

  const messagesByUser = await ctx
    .table("users")
    .getX("email", "tony@stark.com")
    .edge("messages");
  expect(messagesByUser.length).toEqual(1);
  expect(messagesByUser[0].text).toEqual("Hello world");
});

test("has many:many edge", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" });
  const messageId = await ctx
    .table("messages")
    .insert({ text: "Hello world", userId: userId });
  const messageId2 = await ctx
    .table("messages")
    .insert({ text: "Hello to another world", userId: userId });
  const tagId = await ctx
    .table("tags")
    .insert({ name: "cool", messages: [messageId] });
  const tagId2 = await ctx
    .table("tags")
    .insert({ name: "not-cool", messages: [] });
  expect(
    await ctx.table("messages").getX(messageId).edge("tags").has(tagId),
  ).toEqual(true);
  expect(
    await ctx.table("tags").getX(tagId).edge("messages").has(messageId),
  ).toEqual(true);
  expect(
    await ctx.table("tags").getX(tagId2).edge("messages").has(messageId2),
  ).toEqual(false);
  expect(
    await ctx.table("messages").getX(messageId2).edge("tags").has(tagId2),
  ).toEqual(false);
});

test("map many:many edge", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" });
  const messageId = await ctx
    .table("messages")
    .insert({ text: "Hello world", userId: userId });
  const tagId = await ctx
    .table("tags")
    .insert({ name: "cool", messages: [messageId] });
  const users = await ctx
    .table("tags")
    .getX(tagId)
    .edge("messages")
    .map((message) => message.edge("user"));
  expect(users).toMatchObject([{ name: "Stark" }]);
});

test("paginate 1:many edge", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" });
  await ctx.table("messages").insertMany([
    { text: "Hello world", userId: userId },
    { text: "Wow", userId: userId },
    { text: "Incredible", userId: userId },
  ]);

  const firstMessages = await ctx
    .table("users")
    .firstX()
    .edge("messages")
    .paginate({ numItems: 2, cursor: null });
  expect(firstMessages).toMatchObject({
    page: [{ text: "Hello world" }, { text: "Wow" }],
    isDone: false,
  });
  const nextMessages = await ctx
    .table("users")
    .firstX()
    .edge("messages")
    .paginate({ numItems: 2, cursor: firstMessages.continueCursor });
  expect(nextMessages).toMatchObject({
    page: [{ text: "Incredible" }],
    isDone: true,
  });
});

test("paginate many:many edge", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" });
  const messageId = await ctx
    .table("messages")
    .insert({ text: "Hello world", userId: userId });
  await ctx.table("tags").insertMany([
    { name: "cool", messages: [messageId] },
    { name: "funny", messages: [messageId] },
    { name: "smart", messages: [messageId] },
    { name: "wonderful", messages: [messageId] },
    { name: "grose", messages: [messageId] },
    { name: "wonky", messages: [messageId] },
  ]);
  const firstTags = await ctx
    .table("messages")
    .firstX()
    .edge("tags")
    .paginate({ numItems: 2, cursor: null });
  expect(firstTags).toMatchObject({
    page: [{ name: "cool" }, { name: "funny" }],
    isDone: false,
  });
  const nextTags = await ctx
    .table("messages")
    .firstX()
    .edge("tags")
    .paginate({ numItems: 2, cursor: firstTags.continueCursor });
  expect(nextTags).toMatchObject({
    page: [{ name: "smart" }, { name: "wonderful" }],
    isDone: false,
  });
});

test("paginate many:many symmetric edge", async ({ ctx }) => {
  const user1 = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" })
    .get();
  const user2 = await ctx
    .table("users")
    .insert({ name: "Musk", email: "elon@musk.com" })
    .get();
  await user2.patch({ friends: { add: [user1._id] } });
  const friends = await ctx
    .table("users")
    .firstX()
    .edge("friends")
    .paginate({ numItems: 5, cursor: null });
  expect(friends.page.length).toEqual(1);
  expect(friends.page[0].name).toEqual("Musk");
  expect(friends.isDone).toEqual(true);
});

test("take many:many edge", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" });
  const messageId = await ctx
    .table("messages")
    .insert({ text: "Hello world", userId: userId });
  await ctx.table("tags").insertMany([
    { name: "cool", messages: [messageId] },
    { name: "funny", messages: [messageId] },
    { name: "smart", messages: [messageId] },
    { name: "wonderful", messages: [messageId] },
  ]);
  const tags = await ctx.table("messages").firstX().edge("tags").take(3);
  expect(tags).toMatchObject([
    { name: "cool" },
    { name: "funny" },
    { name: "smart" },
  ]);
});

test("take many:many symmetric edge", async ({ ctx }) => {
  const user1 = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" })
    .get();
  const user2 = await ctx
    .table("users")
    .insert({ name: "Musk", email: "elon@musk.com" })
    .get();
  await user2.patch({ friends: { add: [user1._id] } });
  const friends = await ctx.table("users").firstX().edge("friends").take(2);
  expect(friends.length).toEqual(1);
  expect(friends[0].name).toEqual("Musk");
});

test("order many:many edge", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" });
  const messageId = await ctx
    .table("messages")
    .insert({ text: "Hello world", userId: userId });
  await ctx.table("tags").insertMany([
    { name: "cool", messages: [messageId] },
    { name: "funny", messages: [messageId] },
  ]);

  const firstTag = await ctx
    .table("messages")
    .firstX()
    .edge("tags")
    .order("desc")
    .first();
  expect(firstTag).toMatchObject({ name: "funny" });
  const firstXTag = await ctx
    .table("messages")
    .firstX()
    .edge("tags")
    .order("desc")
    .firstX();
  expect(firstXTag).toMatchObject({ name: "funny" });
  await expect(
    async () =>
      await ctx.table("messages").firstX().edge("tags").order("desc").unique(),
  ).rejects.toThrow();
  await expect(
    async () =>
      await ctx.table("messages").firstX().edge("tags").order("desc").uniqueX(),
  ).rejects.toThrow();
});

test("table collect", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" });
  await ctx.table("messages").insert({ text: "Hello world", userId });

  const messages = await ctx.table("messages");
  expect(messages.length).toEqual(1);
  expect(messages[0].text).toEqual("Hello world");
});

test("get", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" });
  await ctx.table("messages").insert({ text: "Hello world", userId });

  const id = (await ctx.table("messages").firstX())._id;
  const message = await ctx.table("messages").get(id);
  expect(message!.text).toEqual("Hello world");
});

test("firstX", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" });
  await ctx.table("messages").insert({ text: "Hello world", userId });

  const message = await ctx.table("messages").firstX();
  expect(message.text).toEqual("Hello world");
});

test("firstX", async ({ ctx }) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" });
  await ctx.table("messages").insert({ text: "Hello world", userId });

  const message = await ctx.table("messages").firstX();
  const messageDoc = message.doc();
  expect(messageDoc.text).toEqual("Hello world");
  // @ts-expect-error documents don't have methods
  messageDoc.edge("user");
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
