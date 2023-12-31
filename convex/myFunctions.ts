import { customCtx, customQuery } from "convex-helpers/server/customFunctions";
import { query as baseQuery, mutation } from "./_generated/server";
import { tableFactory } from "./ents/functions";
import { entDefinitions } from "./schema";

const query = customQuery(
  baseQuery,
  customCtx(async (ctx) => {
    return {
      table: tableFactory(ctx, entDefinitions),
      db: undefined,
    };
  })
);

export const test = query({
  args: {},

  handler: async (ctx) => {
    {
      const message = await ctx
        .table("messages")
        .get("userId", "j57fbye04rgjset0z4dwz33bqx6gnttv" as any);
      return message;
    }
    {
      const foo = ctx.table("users").normalizeId("blabla");
      return foo;
    }
    {
      const friends = await ctx.table("users").first().edge("friends");
      return friends;
    }
    {
      const [first, second] = await ctx.table("users").take(2);
      const user = Math.random() > 0.5 ? first : second;
      const foo = await user.edge("followees").first();
      return foo;
    }
    {
      const firstsFollowees = await ctx
        .table("users")
        .first()
        .edge("followees")
        .first();
      return firstsFollowees;
    }
    {
      const firstMessageTags = await ctx.table("messages").first().edge("tags");
      return firstMessageTags;
    }
    {
      const firstUserProfile = await ctx.table("users").first().edge("profile");
      return firstUserProfile;
    }
    {
      const lastMessageAuthorsMessages = await ctx
        .table("messages")
        .first()
        .edge("user")
        .edge("messages");
      return lastMessageAuthorsMessages;
    }
    {
      const lastMessageAuthor = await ctx
        .table("messages")
        .first()
        .edge("user");
      return lastMessageAuthor;
    }
    {
      const messagesByUser = await ctx
        .table("users")
        .get("email", "srb@convex.dev")
        .edge("messages");
      return messagesByUser;
    }

    {
      const messages = await ctx.table("messages");
      return messages;
    }
    {
      const message = await ctx.table("messages").get("123123213" as any);
      return message;
    }
    {
      const messages = await ctx.table("messages").first();
      return messages;
    }

    // // For single field indexes, we should be able to eq or lt gt directly - but that doesn't
    // // work as you might have multiple indexes with the same first field - you have to
    // // choose the index in convex model, but as Ian suggested if you choose a single field index
    // // you can inline the eq condition, so
    // await ctx.table("messages").get("author", foo._id); // note not authorId even though that's the underlying index
    // // Retrieve the posts of a user
    // // const postsByUser: Post[] = await prisma.user
    // //   .findUnique({ where: { email: "ada@prisma.io" } })
    // //   .posts();
    // const postsByUser = await ctx
    //   .table("users")
    //   .get("email", "srb@convex.dev")
    //   .edge("posts");
    // // Retrieve the profile of a user via a specific post
    // // const authorProfile: Profile | null = await prisma.post
    // // .findUnique({ where: { id: 1 } })
    // // .author()
    // // .profile();
    // const authorProfile = await ctx
    //   .table("posts")
    //   .get(1)
    //   .edge("author")
    //   .edge("profile");
    // // Return all users and include their posts and profile
    // // const users: User[] = await prisma.user.findMany({
    // //   include: {
    // //     posts: true,
    // //     profile: true,
    // //   },
    // // });
    // const users = await ctx.table("users").map(async (user) => ({
    //   ...user,
    //   posts: await user.edge("posts"),
    //   profile: await user.edge("profile"),
    // }));
    // // Select all users and all their post titles
    // // const userPosts = await prisma.user.findMany({
    // //   select: {
    // //     name: true,
    // //     posts: {
    // //       select: {
    // //         title: true,
    // //       },
    // //     },
    // //   },
    // // });
    // const userPosts = await ctx.table("users").map(async (user) => ({
    //   name: user.name,
    //   posts: await user.edge("posts"),
    // }));

    // But if I already have a user, how do I get the posts from them?
    // const user = await ctx.table("users").get("email", "srb@...");
    // const posts = await user.edge("posts");

    // // List all messages
    // // const allPosts = ctx.db.query("posts").collect();
    // const allPosts = await ctx.table("posts");
    // // const userById = ctx.db.get(id);
    // const userById = await ctx.table("posts");
    //// Read the database as many times as you need here.
    //// See https://docs.convex.dev/database/reading-data.
    // const numbers = await ctx.db
    //   .query("numbers")
    //   // Ordered by _creationTime, return most recent
    //   .order("desc")
    //   .take(args.count);
    // return numbers.toReversed().map((number) => number.value);
  },
});

export const seed = mutation(async (ctx) => {
  for (const table of [
    "users",
    "messages",
    "profiles",
    "tags",
    "documents",
    "messages_to_tags",
  ]) {
    for (const { _id } of await ctx.db.query(table as any).collect()) {
      await ctx.db.delete(_id);
    }
  }

  const userId = await ctx.db.insert("users", {
    name: "Stark",
    email: "tony@stark.com",
  });
  const userId2 = await ctx.db.insert("users", {
    name: "Musk",
    email: "elon@musk.com",
  });
  const messageId = await ctx.db.insert("messages", {
    text: "Hello world",
    userId,
  });
  await ctx.db.insert("profiles", {
    bio: "Hello world",
    userId,
  });
  const tagsId = await ctx.db.insert("tags", {
    name: "Orange",
  });
  await ctx.db.insert("messages_to_tags" as any, {
    messagesId: messageId,
    tagsId: tagsId,
  });
  await ctx.db.insert("users_followees_to_followers" as any, {
    followeesId: userId2,
    followersId: userId,
  });
  await ctx.db.insert("users_friends" as any, {
    aId: userId,
    bId: userId2,
  });
  await ctx.db.insert("users_friends" as any, {
    aId: userId2,
    bId: userId,
  });
});

export const list = query(async (ctx, args) => {
  return await ctx.table(args.table as any);
});
