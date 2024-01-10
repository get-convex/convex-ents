import expect from "@storybook/expect";
import { testSuite } from "./testSuite";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { Ent, EntWriter } from "./types";

function assertEqual(actual: any, expected: any) {
  expect(actual).toEqual(expected);
}

const { test, testOnly, setup, runner, query, mutation } = testSuite();

setup(async (ctx) => {
  const user1 = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com", height: 3 })
    .get();
  const user2 = await ctx
    .table("users")
    .insert({ name: "Musk", email: "elon@musk.com" })
    .get();
  const message = await ctx
    .table("messages")
    .insert({ text: "Hello world", userId: user1._id })
    .get();
  await ctx.table("profiles").insert({ bio: "Hello world", userId: user1._id });
  const tagsId = await ctx.table("tags").insert({ name: "Orange" });
  await message.patch({ tags: { add: [tagsId] } });
  await user1.patch({ followees: { add: [user2._id] } });
  await user2.patch({ friends: { add: [user1._id] } });
  await ctx.table("posts").insert({ text: "My great post" } as any);
  await ctx.table("posts").insertMany([
    { text: "My great video", type: "video", numLikes: 4 },
    { text: "My awesome video", type: "video", numLikes: 0 },
  ]);
  await ctx.omni("secrets").insertMany([
    { value: "chicka blah", userId: user1._id },
    { value: "bada boom", userId: user2._id },
  ]);
});

test("index field", async (ctx) => {
  const userByHeight = await ctx.table("users").getX("height", 3);
  expect(userByHeight.name).toEqual("Stark");
});

test("default fields", async (ctx) => {
  const firstPost = await ctx.table("posts").firstX();
  assertEqual(firstPost.numLikes, 0);
  assertEqual(firstPost.type, "text");
});

test("1:1 edge from field side", async (ctx) => {
  const firstProfileUser = await ctx.table("profiles").firstX().edge("user");
  expect(firstProfileUser.name).toEqual("Stark");
});

// No difference in type, since the edge is required
test("1:1 edgeX from field side", async (ctx) => {
  const firstProfileUser = await ctx.table("profiles").firstX().edgeX("user");
  expect(firstProfileUser.name).toEqual("Stark");
});

test("1:1 edge from ref side, existing", async (ctx) => {
  const firstUserProfile = await ctx.table("users").firstX().edge("profile");
  expect(firstUserProfile).not.toBeNull();
});

test("1:1 edge from ref side, missing", async (ctx) => {
  const firstUserProfile = await ctx
    .table("users")
    .getX("email", "elon@musk.com")
    .edge("profile");
  expect(firstUserProfile).toBeNull();
});

test("1:1 edgeX from ref side, existing", async (ctx) => {
  const firstUserProfile = await ctx.table("users").firstX().edgeX("profile");
  assertEqual(firstUserProfile.bio, "Hello world");
});

test("1:1 edgeX from ref side, missing", async (ctx) => {
  expect(async () => {
    await ctx.table("users").getX("email", "elon@musk.com").edgeX("profile");
  }).rejects.toThrowError('Edge "profile" does not exist for document with ID');
});

test("has method", async (ctx) => {
  const tag = await ctx.table("tags").firstX();
  const hasTag = await ctx.table("messages").first().edge("tags").has(tag._id);
  expect(hasTag).toEqual(true);
});

test("getMany", async (ctx) => {
  const users = await ctx.table("users");
  const specificUsers = await ctx
    .table("users")
    .getMany([users[0]._id, users[1]._id]);
  expect(specificUsers).toHaveLength(2);
  assertEqual(specificUsers[0]?.name, users[0].name);
  assertEqual(specificUsers[1]?.name, users[1].name);
});

test("getManyX", async (ctx) => {
  const users = await ctx.table("users");
  const specificUsers = await ctx
    .table("users")
    .getManyX([users[0]._id, users[1]._id]);
  expect(specificUsers).toHaveLength(2);
  assertEqual(specificUsers[0]?.name, users[0].name);
  assertEqual(specificUsers[1]?.name, users[1].name);
});

test("table using index", async (ctx) => {
  const firstVideoWithMoreThan3Likes = await ctx
    .table("posts", "numLikesAndType", (q) =>
      q.eq("type", "video").gt("numLikes", 3)
    )
    .firstX();
  assertEqual(firstVideoWithMoreThan3Likes.text, "My great video");
  assertEqual(firstVideoWithMoreThan3Likes.numLikes, 4);
  assertEqual(firstVideoWithMoreThan3Likes.type, "video");
});

test("search", async (ctx) => {
  const foundPost = await ctx
    .table("posts")
    .search("text", (q) => q.search("text", "awesome").eq("type", "video"))
    .firstX();
  assertEqual(foundPost.text, "My awesome video");
  assertEqual(foundPost.numLikes, 0);
  assertEqual(foundPost.type, "video");
});

test("type of ent", async (ctx) => {
  const someFlag = false;
  const [firstUser, secondUser] = await ctx.table("users").take(2);
  const user = someFlag ? firstUser : secondUser;
  const usersFirstFollower = (await user.edge("followers"))[0];
  assertEqual(usersFirstFollower, firstUser);
});

test("map with edges", async (ctx) => {
  const usersWithMessagesAndProfile = await ctx
    .table("users")
    .map(async (user) => ({
      ...user,
      messages: await user.edge("messages"),
      profile: await user.edge("profile"),
    }));
  expect(usersWithMessagesAndProfile).toHaveLength(2);
  assertEqual(usersWithMessagesAndProfile[0].name, "Stark");
  assertEqual(usersWithMessagesAndProfile[0].messages.length, 1);
  assertEqual(usersWithMessagesAndProfile[1].name, "Musk");
  assertEqual(usersWithMessagesAndProfile[1].messages.length, 0);
  assertEqual(Object.keys(usersWithMessagesAndProfile[0]), [
    "_creationTime",
    "_id",
    "email",
    "height",
    "name",
    "messages",
    "profile",
  ]);
  assertEqual(usersWithMessagesAndProfile[0].profile!.bio, "Hello world");
});

test("map with edges using doc and docs", async (ctx) => {
  const usersWithMessagesAndProfile = await ctx
    .table("users")
    .map(async (user) => ({
      ...user,
      messages: await user.edge("messages").docs(),
      profile: await user.edge("profile").doc(),
    }));
  expect(usersWithMessagesAndProfile).toHaveLength(2);
  assertEqual(usersWithMessagesAndProfile[0].name, "Stark");
  assertEqual(usersWithMessagesAndProfile[0].messages.length, 1);
  assertEqual(usersWithMessagesAndProfile[1].name, "Musk");
  assertEqual(usersWithMessagesAndProfile[1].messages.length, 0);
  assertEqual(Object.keys(usersWithMessagesAndProfile[0]), [
    "_creationTime",
    "_id",
    "email",
    "height",
    "name",
    "messages",
    "profile",
  ]);
  assertEqual(usersWithMessagesAndProfile[0].profile!.bio, "Hello world");
});

test("map with nested map", async (ctx) => {
  const usersWithMessageTexts = await ctx.table("users").map(async (user) => ({
    name: user.name,
    email: user.email,
    messages: (await user.edge("messages")).map((message) => message.text),
  }));
  assertEqual(usersWithMessageTexts, [
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

test("types: spread should remove methods", async (ctx) => {
  const firstUser = await ctx.table("users").firstX();
  const user = { ...firstUser };
  async () => {
    // @ts-expect-error edge should not be available on the spreaded object
    await user.edge("profile");
  };
});

test("types: Ent", async (ctx) => {
  const firstMessage: Ent<"messages"> = await ctx.table("messages").firstX();
  const message = { ...firstMessage };
  async () => {
    // @ts-expect-error edge should not be available on the spreaded object
    await message.edge("user");
  };
  assertEqual(message.text, "Hello world");
});

test("types: EntWriter", async (ctx) => {
  const firstMessage: EntWriter<"messages"> = await ctx
    .table("messages")
    .firstX();
  const message = { ...firstMessage };
  async () => {
    // @ts-expect-error edge should not be available on the spreaded object
    await message.edge("user");
  };
  assertEqual(message.text, "Hello world");
});

test("edge", async (ctx) => {
  const firstProfile = await ctx.table("profiles").firstX();
  const user = await firstProfile.edge("user");
  assertEqual(user.name, "Stark");
});

test("getX with index", async (ctx) => {
  const id = (await ctx.table("users").firstX())._id;
  const message = await ctx.table("messages").getX("userId", id);
  assertEqual(message.text, "Hello world");
});

test("normalizeId", async (ctx) => {
  const foo = ctx.table("users").normalizeId("blabla");
  assertEqual(foo, null);
  const id = (await ctx.table("users").firstX())._id;
  const idToo = ctx.table("users").normalizeId(id);
  assertEqual(id, idToo);
});

test("symmetric many:many edge", async (ctx) => {
  const friends = await ctx.table("users").firstX().edge("friends");
  assertEqual(friends.length, 1);
  assertEqual(friends[0].name, "Musk");
  assertEqual((await friends[0].edge("friends"))[0].name, "Stark");
});

test("many to many edge first", async (ctx) => {
  const firstsFirstFollowee = (
    await ctx.table("users").firstX().edge("followees")
  )[0]!;
  assertEqual(firstsFirstFollowee.name, "Musk");
});

test("many to many edge", async (ctx) => {
  const firstMessageTags = await ctx.table("messages").firstX().edge("tags");
  assertEqual(firstMessageTags.length, 1);
  assertEqual(firstMessageTags[0].name, "Orange");
});

test("paginate", async (ctx) => {
  const paginatedUsersByEmail = await ctx
    .table("users")
    .order("asc", "email")
    .paginate({ cursor: null, numItems: 5 });
  assertEqual(paginatedUsersByEmail.page[0].name, "Musk");
  assertEqual(paginatedUsersByEmail.page[1].name, "Stark");
});

test("edge after edge", async (ctx) => {
  const lastMessageAuthorsMessages = await ctx
    .table("messages")
    .order("desc")
    .firstX()
    .edge("user")
    .edge("messages");
  assertEqual(lastMessageAuthorsMessages.length, 1);
  assertEqual(lastMessageAuthorsMessages[0].text, "Hello world");
});

test("1:many edge from field end", async (ctx) => {
  const lastMessageAuthor = await ctx.table("messages").firstX().edge("user");
  assertEqual(lastMessageAuthor.name, "Stark");
});

test("edge after getX using index", async (ctx) => {
  const messagesByUser = await ctx
    .table("users")
    .getX("email", "tony@stark.com")
    .edge("messages");
  assertEqual(messagesByUser.length, 1);
  assertEqual(messagesByUser[0].text, "Hello world");
});

test("table collect", async (ctx) => {
  const messages = await ctx.table("messages");
  assertEqual(messages.length, 1);
  assertEqual(messages[0].text, "Hello world");
});

test("get", async (ctx) => {
  const id = (await ctx.table("messages").firstX())._id;
  const message = await ctx.table("messages").get(id);
  assertEqual(message!.text, "Hello world");
});

test("firstX", async (ctx) => {
  const messages = await ctx.table("messages").firstX();
  assertEqual(messages.text, "Hello world");
});

// First created user is set as viewer
test("rules - query", async (ctx) => {
  const secrets = await ctx.table("secrets");
  expect(secrets).toHaveLength(1);
});

// First created user is set as viewer
test("rules - firstX", async (ctx) => {
  const secret = await ctx.table("secrets").order("desc").firstX();
  expect(secret).not.toBeNull();
});

// First created user is set as viewer
test("rules - edge", async (ctx) => {
  const [firstUser, secondUser] = await ctx.table("users").take(2);
  const viewerSecret = await firstUser.edge("secret");
  expect(viewerSecret?.value).toEqual("chicka blah");
  const otherSecret = await secondUser.edge("secret");
  expect(otherSecret).toEqual(null);
});

// TODO:
// // For single field indexes, we should be able to eq or lt gt directly - but that doesn't
// // work as you might have multiple indexes with the same first field - you have to
// // choose the index in convex model, but as Ian suggested if you choose a single field index
// // you can inline the eq condition, so
// await ctx.table("messages").get("author", foo._id); // note not authorId even though that's the underlying index

export { query, mutation };

export const runTests = action(async (ctx) => {
  await runner(ctx, { query: api.read.query, mutation: api.read.mutation });
});
