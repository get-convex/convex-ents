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
      db: undefined,
    };
  })
);

const mutation = customMutation(
  baseMutation,
  customCtx(async (ctx) => {
    return {
      table: entsWriterFactory(ctx, entDefinitions),
      db: undefined,
    };
  })
);

export const test = query({
  args: {},

  handler: async (ctx) => {
    {
      // Default fields
      const firstPost = await ctx.table("posts").first();
      assertEqual(firstPost!.numLikes, 0);
      assertEqual(firstPost!.type, "text");
    }
    {
      const firstVideoWithMoreThan3Likes = await ctx
        .table("posts", "numLikesAndType", (q) =>
          q.eq("type", "video").gt("numLikes", 3)
        )
        .first();
      assertEqual(firstVideoWithMoreThan3Likes!.text, "My great video");
      assertEqual(firstVideoWithMoreThan3Likes!.numLikes, 4);
      assertEqual(firstVideoWithMoreThan3Likes!.type, "video");
    }
    {
      const foundPost = await ctx
        .table("posts")
        .search("text", (q) => q.search("text", "awesome").eq("type", "video"))
        .first();
      assertEqual(foundPost!.text, "My awesome video");
      assertEqual(foundPost!.numLikes, 0);
      assertEqual(foundPost!.type, "video");
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
      const firstProfile = await ctx.table("profiles").first();
      const user = await firstProfile!.edge("user");
      assertEqual(user.name, "Stark");
    }
    {
      const id = (await ctx.table("users").first())!._id;
      const message = await ctx.table("messages").get("userId", id);
      assertEqual(message!.text, "Hello world");
    }
    {
      const foo = ctx.table("users").normalizeId("blabla");
      assertEqual(foo, null);
      const id = (await ctx.table("users").first())!._id;
      const idToo = ctx.table("users").normalizeId(id);
      assertEqual(id, idToo);
    }
    {
      const friends = await ctx.table("users").first().edge("friends");
      assertEqual(friends!.length, 1);
      assertEqual(friends![0].name, "Musk");
    }

    {
      const firstsFirstFollowee = await ctx
        .table("users")
        .first()
        .edge("followees")
        .first();
      assertEqual(firstsFirstFollowee!.name, "Musk");
    }
    {
      const firstMessageTags = await ctx.table("messages").first().edge("tags");
      assertEqual(firstMessageTags!.length, 1);
      assertEqual(firstMessageTags![0].name, "Orange");
    }
    {
      const firstUserProfile = await ctx.table("users").first().edge("profile");
      assertEqual(firstUserProfile!.bio, "Hello world");
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
        .first()
        .edge("user")
        .edge("messages");
      assertEqual(lastMessageAuthorsMessages!.length, 1);
      assertEqual(lastMessageAuthorsMessages![0].text, "Hello world");
    }
    {
      const lastMessageAuthor = await ctx
        .table("messages")
        .first()
        .edge("user");
      assertEqual(lastMessageAuthor!.name, "Stark");
    }
    {
      const messagesByUser = await ctx
        .table("users")
        .get("email", "tony@stark.com")
        .edge("messages");
      assertEqual(messagesByUser!.length, 1);
      assertEqual(messagesByUser![0].text, "Hello world");
    }

    {
      const messages = await ctx.table("messages");
      assertEqual(messages.length, 1);
      assertEqual(messages[0].text, "Hello world");
    }
    {
      const id = (await ctx.table("messages").first())!._id;
      const message = await ctx.table("messages").get(id);
      assertEqual(message!.text, "Hello world");
    }
    {
      const messages = await ctx.table("messages").first();
      assertEqual(messages!.text, "Hello world");
    }

    // // For single field indexes, we should be able to eq or lt gt directly - but that doesn't
    // // work as you might have multiple indexes with the same first field - you have to
    // // choose the index in convex model, but as Ian suggested if you choose a single field index
    // // you can inline the eq condition, so
    // await ctx.table("messages").get("author", foo._id); // note not authorId even though that's the underlying index
  },
});

export const seed = mutation(async (ctx) => {
  // Note: Currently not deleting edges
  for (const table of [
    "users",
    "messages",
    "profiles",
    "tags",
    "posts",
  ] as const) {
    for (const { _id } of await ctx.table(table)) {
      await ctx.table(table).delete(_id);
    }
  }

  const userId = await ctx.table("users").insert({
    name: "Stark",
    email: "tony@stark.com",
  });
  const userId2 = await ctx.table("users").insert({
    name: "Musk",
    email: "elon@musk.com",
  });
  const messageId = await ctx.table("messages").insert({
    text: "Hello world",
    userId,
  });
  await ctx.table("profiles").insert({
    bio: "Hello world",
    userId,
  });
  const tagsId = await ctx.table("tags").insert({
    name: "Orange",
  });
  await ctx.table("messages_to_tags" as any).insert({
    messagesId: messageId,
    tagsId: tagsId,
  });
  await ctx.table("users_followees_to_followers" as any).insert({
    followeesId: userId2,
    followersId: userId,
  });
  await ctx.table("users_friends" as any).insert({
    aId: userId,
    bId: userId2,
  });
  await ctx.table("users_friends" as any).insert({
    aId: userId2,
    bId: userId,
  });
  await ctx.table("posts").insert({ text: "My great post" });
  await ctx.table("posts").insert({
    text: "My great video",
    type: "video",
    numLikes: 4,
  });
  await ctx.table("posts").insert({
    text: "My awesome video",
    type: "video",
    numLikes: 0,
  });
});

export const list = query(async (ctx, args) => {
  return await ctx.table(args.table as any);
});

function assertEqual(actual: any, expected: any) {
  expect(actual).toEqual(expected);
}
