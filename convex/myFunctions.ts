import {
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import {
  query as baseQuery,
  mutation as baseMutation,
} from "./_generated/server";
import { entsReaderFactory, entsWriterFactory } from "./ents/functions";
import expect from "@storybook/expect";
import { entDefinitions } from "./schema";

const query = customQuery(
  baseQuery,
  customCtx(async (ctx) => {
    return {
      table: entsReaderFactory(ctx, entDefinitions),
      db: ctx.db as unknown as undefined,
    };
  })
);

const mutation = customMutation(
  baseMutation,
  customCtx(async (ctx) => {
    return {
      table: entsWriterFactory(ctx, entDefinitions),
      db: ctx.db as unknown as undefined,
    };
  })
);

export const test = query({
  args: {},

  handler: async (ctx) => {
    {
      // Default fields
      const firstPost = await ctx.table("posts").firstX();
      assertEqual(firstPost.numLikes, 0);
      assertEqual(firstPost.type, "text");
    }
    {
      const firstVideoWithMoreThan3Likes = await ctx
        .table("posts", "numLikesAndType", (q) =>
          q.eq("type", "video").gt("numLikes", 3)
        )
        .firstX();
      assertEqual(firstVideoWithMoreThan3Likes.text, "My great video");
      assertEqual(firstVideoWithMoreThan3Likes.numLikes, 4);
      assertEqual(firstVideoWithMoreThan3Likes.type, "video");
    }
    {
      const foundPost = await ctx
        .table("posts")
        .search("text", (q) => q.search("text", "awesome").eq("type", "video"))
        .firstX();
      assertEqual(foundPost.text, "My awesome video");
      assertEqual(foundPost.numLikes, 0);
      assertEqual(foundPost.type, "video");
    }
    {
      const someFlag = false;
      const [firstUser, secondUser] = await ctx.table("users").take(2);
      const user = someFlag ? firstUser : secondUser;
      const usersFirstFollower = await user.edge("followers").first();
      assertEqual(usersFirstFollower, firstUser);
    }
    {
      const usersWithMessagesAndProfile = await ctx
        .table("users")
        .map(async (user) => ({
          ...user,
          messages: await user.edge("messages"),
          profile: await user.edge("profile"),
        }));
      assertEqual(usersWithMessagesAndProfile.length, 2);
      assertEqual(usersWithMessagesAndProfile[0].name, "Stark");
      assertEqual(usersWithMessagesAndProfile[0].messages.length, 1);
      assertEqual(usersWithMessagesAndProfile[1].name, "Musk");
      assertEqual(usersWithMessagesAndProfile[1].messages.length, 0);
      assertEqual(Object.keys(usersWithMessagesAndProfile[0]), [
        "_creationTime",
        "_id",
        "email",
        "name",
        "messages",
        "profile",
      ]);
      assertEqual(usersWithMessagesAndProfile[0].profile!.bio, "Hello world");
    }

    {
      const usersWithMessageTexts = await ctx
        .table("users")
        .map(async (user) => ({
          name: user.name,
          email: user.email,
          messages: (
            await user.edge("messages")
          ).map((message) => message.text),
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
    }

    {
      const firstProfile = await ctx.table("profiles").firstX();
      const user = await firstProfile.edge("user");
      assertEqual(user.name, "Stark");
    }
    {
      const id = (await ctx.table("users").firstX())._id;
      const message = await ctx.table("messages").getX("userId", id);
      assertEqual(message.text, "Hello world");
    }
    {
      const foo = ctx.table("users").normalizeId("blabla");
      assertEqual(foo, null);
      const id = (await ctx.table("users").firstX())._id;
      const idToo = ctx.table("users").normalizeId(id);
      assertEqual(id, idToo);
    }
    {
      const friends = await ctx.table("users").firstX().edge("friends");
      assertEqual(friends.length, 1);
      assertEqual(friends[0].name, "Musk");
      assertEqual((await friends[0].edge("friends"))[0].name, "Stark");
    }

    {
      const firstsFirstFollowee = await ctx
        .table("users")
        .firstX()
        .edge("followees")
        .firstX();
      assertEqual(firstsFirstFollowee.name, "Musk");
    }
    {
      const firstMessageTags = await ctx
        .table("messages")
        .firstX()
        .edge("tags");
      assertEqual(firstMessageTags.length, 1);
      assertEqual(firstMessageTags[0].name, "Orange");
    }
    {
      const firstUserProfile = await ctx
        .table("users")
        .firstX()
        .edgeX("profile");
      assertEqual(firstUserProfile.bio, "Hello world");
    }
    {
      const paginatedUsersByEmail = await ctx
        .table("users")
        .order("asc", "email")
        .paginate({ cursor: null, numItems: 5 });
      assertEqual(paginatedUsersByEmail.page[0].name, "Musk");
      assertEqual(paginatedUsersByEmail.page[1].name, "Stark");
    }
    {
      const lastMessageAuthorsMessages = await ctx
        .table("messages")
        .order("desc")
        .firstX()
        .edge("user")
        .edge("messages");
      assertEqual(lastMessageAuthorsMessages.length, 1);
      assertEqual(lastMessageAuthorsMessages[0].text, "Hello world");
    }
    {
      const lastMessageAuthor = await ctx
        .table("messages")
        .firstX()
        .edge("user");
      assertEqual(lastMessageAuthor.name, "Stark");
    }
    {
      const messagesByUser = await ctx
        .table("users")
        .getX("email", "tony@stark.com")
        .edge("messages");
      assertEqual(messagesByUser.length, 1);
      assertEqual(messagesByUser[0].text, "Hello world");
    }

    {
      const messages = await ctx.table("messages");
      assertEqual(messages.length, 1);
      assertEqual(messages[0].text, "Hello world");
    }
    {
      const id = (await ctx.table("messages").firstX())._id;
      const message = await ctx.table("messages").get(id);
      assertEqual(message!.text, "Hello world");
    }
    {
      const messages = await ctx.table("messages").firstX();
      assertEqual(messages.text, "Hello world");
    }

    // // For single field indexes, we should be able to eq or lt gt directly - but that doesn't
    // // work as you might have multiple indexes with the same first field - you have to
    // // choose the index in convex model, but as Ian suggested if you choose a single field index
    // // you can inline the eq condition, so
    // await ctx.table("messages").get("author", foo._id); // note not authorId even though that's the underlying index
  },
});

export const test2 = mutation(async (ctx) => {
  // Test field uniqueness check
  {
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
  }
  // Test uniqueness check
  {
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
  }

  // Insert 1:1 from ref side is not possible, because the required side of
  // the edge cannot be removed.
  {
    async () => {
      const someProfile = await ctx.table("profiles").first();
      await ctx.table("users").insert({
        name: "Gates",
        email: "bill@gates.com",
        // @ts-expect-error This is not allowed
        profile: someProfile._id,
      });
    };
  }
  // Insert 1:many from ref side
  {
    const someUser = await ctx.table("users").firstX();
    const newMessageId = await ctx.table("messages").insert({
      text: "Hello world",
      userId: someUser._id,
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
  }
  // Insert many:many
  {
    const someUser = await ctx.table("users").firstX();
    const newMessageId = await ctx.table("messages").insert({
      text: "Hello world",
      userId: someUser._id,
    });
    const newTagId = await ctx.table("tags").insert({
      name: "Blue",
      messages: [newMessageId],
    });
    const messageTags = await ctx
      .table("messages")
      .getX(newMessageId)
      .edge("tags");
    assertEqual(messageTags.length, 1);
    assertEqual(messageTags[0].name, "Blue");

    // Test the edge deletion behavior
    assertEqual(
      (await (ctx.db as any).query("messages_to_tags").collect()).length,
      2
    );
    await ctx.table("messages").getX(newMessageId).delete();
    assertEqual(
      (await (ctx.db as any).query("messages_to_tags").collect()).length,
      1
    );

    await ctx.table("tags").getX(newTagId).delete();
  }
  // Test symmetric many:many
  {
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
  }

  // Patch 1:1 from ref side is not possible, because the required side of
  // the edge cannot be removed.
  {
    const someUser = await ctx.table("users").firstX();
    const someProfile = await ctx.table("profiles").firstX();
    async () => {
      await ctx.table("users").getX(someUser._id).patch({
        // @ts-expect-error This is not allowed
        profile: someProfile._id,
      });
    };
  }
});

export const seed = mutation(async (ctx) => {
  for (const table of [
    "users",
    "messages",
    "profiles",
    "tags",
    "posts",
  ] as const) {
    // TODO: in the future
    // await ctx.table(table).map(doc => doc.delete());
    for (const { _id } of await ctx.table(table)) {
      await ctx.table(table).getX(_id).delete();
    }
  }

  const user1 = await ctx
    .table("users")
    .insert({ name: "Stark", email: "tony@stark.com" })
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
});

export const list = query(async (ctx, args) => {
  return await ctx.table(args.table as any);
});

function assertEqual(actual: any, expected: any) {
  expect(actual).toEqual(expected);
}
