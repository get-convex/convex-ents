import expect from "@storybook/expect";
import { testSuite } from "./testSuite";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { test, testOnly, setup, mutation, runner } = testSuite();

setup(async (ctx) => {
  // Setting up the viewer
  await ctx.table("users").insert({ name: "Stark", email: "tony@stark.com" });
});

test("unique field check", async (ctx) => {
  const newUserId = await ctx.table("users").insert({
    name: "Gates",
    email: "bill@gates.com",
  });
  await expect(async () => {
    await ctx.table("users").insert({
      name: "Mellinda",
      email: "bill@gates.com",
    });
  }).rejects.toThrowError(
    `In table "users" cannot create a duplicate document with field "email" of value \`bill@gates.com\``
  );
  await ctx.table("users").getX(newUserId).delete();
});

test("uniqueness check", async (ctx) => {
  const newUserId = await ctx.table("users").insert({
    name: "Gates",
    email: "bill@gates.com",
  });
  const newProfileId = await ctx.table("profiles").insert({
    bio: "Hello world",
    userId: newUserId,
  });
  await expect(async () => {
    await ctx.table("profiles").insert({
      bio: "Better world",
      userId: newUserId,
    });
  }).rejects.toThrowError(
    `In table "profiles" cannot create a duplicate 1:1 edge "user"`
  );
  await ctx.table("profiles").getX(newProfileId).delete();
  await ctx.table("users").getX(newUserId).delete();
});

// Insert 1:1 from ref side is not possible, because the required side of
// the edge cannot be removed.
test("insert 1:1 from ref side", async (ctx) => {
  async () => {
    const someProfile = await ctx.table("profiles").firstX();
    await ctx.table("users").insert({
      name: "Gates",
      email: "bill@gates.com",
      profile: someProfile._id,
    });
  };
});
// Insert 1:many from ref side
test("", async (ctx) => {
  const someUserId = await ctx.table("users").insert({
    name: "Jobs",
    email: "steve@jobs.com",
  });
  const newMessageId = await ctx.table("messages").insert({
    text: "Hello world",
    userId: someUserId,
  });
  const newUserId = await ctx.table("users").insert({
    name: "Gates",
    email: "bill@gates.com",
    messages: [newMessageId],
  });
  const updatedMessage = await ctx.table("messages").getX(newMessageId);
  assertEqual(updatedMessage.userId, newUserId);
  await ctx.table("users").getX(newUserId).delete();
  // Messages get deleted automatically via cascading delete:
  const deletedMessage = await ctx.table("messages").get(newMessageId);
  assertEqual(deletedMessage, null);
});

test("insert and delete many:many", async (ctx) => {
  const someUserId = await ctx.table("users").insert({
    name: "Gates",
    email: "bill@gates.com",
  });
  const newMessageId = await ctx.table("messages").insert({
    text: "Hello world",
    userId: someUserId,
  });
  const newTag = await ctx
    .table("tags")
    .insert({ name: "Blue", messages: [newMessageId] })
    .get();
  expect(await newTag.edge("messages")).toHaveLength(1);

  const messageTags = await ctx
    .table("messages")
    .getX(newMessageId)
    .edge("tags");
  expect(messageTags).toHaveLength(1);
  expect(messageTags[0].name).toEqual("Blue");

  // Test the edge deletion behavior
  expect(
    await (ctx.db as any).query("messages_to_tags").collect()
  ).toHaveLength(1);
  await ctx.table("messages").getX(newMessageId).delete();
  expect(
    await (ctx.db as any).query("messages_to_tags").collect()
  ).toHaveLength(0);
});

test("symmetric many:many", async (ctx) => {
  const friendId = await ctx.table("users").insert({
    name: "Jobs",
    email: "steve@jobs.com",
  });
  const friend = await ctx.table("users").getX(friendId);
  const newUserId = await ctx.table("users").insert({
    name: "Gates",
    email: "bill@gates.com",
    friends: [friendId],
  });
  const newUser = await ctx.table("users").getX(newUserId);
  const newUserFriends = await newUser.edge("friends");
  assertEqual(newUserFriends.length, 1);
  const someUserFriends = await friend.edge("friends");
  assertEqual(someUserFriends.length, 1);
  assertEqual(newUserFriends[0].name, "Jobs");

  // Test correct deletion
  const updatedFriends = await newUser
    .replace({ name: "Gates", email: "bill@gates.com" })
    .get()
    .edge("friends");
  assertEqual(updatedFriends.length, 0);
  const updatedSomeUserFriends = await friend.edge("friends");
  assertEqual(updatedSomeUserFriends.length, 0);

  await friend.delete();
  await newUser.delete();
});

// Patch 1:1 from ref side is not possible, because the required side of
// the edge cannot be removed.
test("patch 1:1 from ref side", async (ctx) => {
  const someUserId = await ctx
    .table("users")
    .insert({ name: "Jobs", email: "steve@jobs.com" });
  const someProfile = await ctx
    .table("profiles")
    .insert({ bio: "Hello world", userId: someUserId });

  async () => {
    await ctx.table("users").getX(someUserId).patch({
      // @ts-expect-error This is not allowed
      profile: someProfile._id,
    });
  };
});

// Patch 1:many from ref side is not possible, because the required side of
// the edge cannot be removed.
test("patch 1:many from ref side", async (ctx) => {
  const someUserId = await ctx
    .table("users")
    .insert({ name: "Jobs", email: "steve@jobs.com" });
  const message = await ctx
    .table("messages")
    .insert({ text: "Hello world", userId: someUserId });

  async () => {
    await ctx.table("users").getX(someUserId).patch({
      // @ts-expect-error This is not allowed
      message: message._id,
    });
  };
});

// Replace 1:1 from ref side is not possible, because the required side of
// the edge cannot be removed.
test("replace 1:1 from ref side", async (ctx) => {
  const someUserId = await ctx
    .table("users")
    .insert({ name: "Jobs", email: "steve@jobs.com" });
  const someProfile = await ctx
    .table("profiles")
    .insert({ bio: "Hello world", userId: someUserId });

  async () => {
    await ctx.table("users").getX(someUserId).replace({
      name: "foo",
      email: "bar",
      // @ts-expect-error This is not allowed
      profile: someProfile._id,
    });
  };
});

// Replace 1:many from ref side is not possible, because the required side of
// the edge cannot be removed.
test("replace 1:many from ref side", async (ctx) => {
  const someUserId = await ctx
    .table("users")
    .insert({ name: "Jobs", email: "steve@jobs.com" });
  const message = await ctx
    .table("messages")
    .insert({ text: "Hello world", userId: someUserId });

  async () => {
    await ctx.table("users").getX(someUserId).replace({
      name: "foo",
      email: "bar",
      // @ts-expect-error This is not allowed
      message: message._id,
    });
  };
});

test("simple patch", async (ctx) => {
  const newUser = await ctx
    .table("users")
    .insert({ name: "Gates", email: "bill@gates.com" })
    .get();
  const updatedUser = await newUser.patch({ name: "Bill" }).get();
  assertEqual(updatedUser.name, "Bill");
  assertEqual(updatedUser.email, "bill@gates.com");
});

test("write rule on insert", async (ctx) => {
  const viewer = await ctx.table("users").firstX();
  const otherUserId = await ctx
    .table("users")
    .insert({ name: "Jobs", email: "steve@jobs.com" });
  // rules.ts: This works because the viewer is writing
  await ctx.table("secrets").insert({ value: "123", ownerId: viewer._id });
  await expect(async () => {
    // rules.ts: We only allow the viewer to create secrets
    await ctx.table("secrets").insert({
      value: "123",
      ownerId: otherUserId,
    });
  }).rejects.toThrowError(`Cannot insert into table "secrets":`);
});

test("write rule on delete", async (ctx) => {
  const viewer = await ctx.table("users").firstX();
  const secret = await ctx
    .table("secrets")
    .insert({ value: "123", ownerId: viewer._id })
    .get();
  await expect(async () => {
    // rules.ts: We don't allow anyone to delete a secret
    await secret.delete();
  }).rejects.toThrowError(`Cannot delete from table "secrets" with ID`);
});

test("read rule on patch", async (ctx) => {
  const otherUserId = await ctx
    .table("users")
    .insert({ name: "Jobs", email: "steve@jobs.com" });
  const secretId = await ctx.skipRules
    .table("secrets")
    .insert({ value: "123", ownerId: otherUserId });

  await expect(async () => {
    // rules.ts: Only owners can see and update their secrets
    await ctx.table("secrets").getX(secretId).patch({ value: "456" });
  }).rejects.toThrowError(`Cannot update document with ID`);
});

test("write rule on patch", async (ctx) => {
  const otherUserId = await ctx
    .table("users")
    .insert({ name: "Jobs", email: "steve@jobs.com" });
  const secretId = await ctx.skipRules
    .table("secrets")
    .insert({ value: "123", ownerId: ctx.viewerId! });

  await expect(async () => {
    // rules.ts: The user edge is immutable
    await ctx.table("secrets").getX(secretId).patch({ ownerId: otherUserId });
  }).rejects.toThrowError(`Cannot update document with ID`);

  // This is ok
  await ctx.table("secrets").getX(secretId).patch({ value: "456" });
});

test("read rule on replace", async (ctx) => {
  const otherUserId = await ctx
    .table("users")
    .insert({ name: "Jobs", email: "steve@jobs.com" });
  const secretId = await ctx.skipRules
    .table("secrets")
    .insert({ value: "123", ownerId: otherUserId });

  await expect(async () => {
    // rules.ts: Only owners can see and update their secrets
    await ctx
      .table("secrets")
      .getX(secretId)
      .replace({ ownerId: otherUserId, value: "456" });
  }).rejects.toThrowError(`Cannot update document with ID`);
});

test("write rule on replace", async (ctx) => {
  const otherUserId = await ctx
    .table("users")
    .insert({ name: "Jobs", email: "steve@jobs.com" });
  const secretId = await ctx.skipRules
    .table("secrets")
    .insert({ value: "123", ownerId: ctx.viewerId! });

  await expect(async () => {
    // rules.ts: The user edge is immutable
    await ctx
      .table("secrets")
      .getX(secretId)
      .replace({ ownerId: otherUserId, value: "456" });
  }).rejects.toThrowError(`Cannot update document with ID`);

  // This is ok
  await ctx
    .table("secrets")
    .getX(secretId)
    .replace({ ownerId: ctx.viewerId!, value: "456" });
});

test("cascading deletes", async (ctx) => {
  const userId = await ctx
    .table("users")
    .insert({ name: "Jobs", email: "steve@jobs.com" });
  const messageId = await ctx
    .table("messages")
    .insert({ text: "Hello world", userId });
  const messageDetailId = await ctx
    .table("messageDetails")
    .insert({ value: "Some detail", messageId });

  await ctx.table("users").getX(userId).delete();

  const deletedMessage = await ctx.table("messages").get(messageId);
  expect(deletedMessage).toBeNull();
  const deletedMessageDetail = await ctx
    .table("messageDetails")
    .get(messageDetailId);
  expect(deletedMessageDetail).toBeNull();
});

function assertEqual(actual: any, expected: any) {
  expect(actual).toEqual(expected);
}

export { mutation };

export const runTests = action(async (ctx) => {
  await runner(ctx, { mutation: api.write.mutation });
});
