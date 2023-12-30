import { customCtx, customQuery } from "convex-helpers/server/customFunctions";
import {
  DocumentByName,
  FieldTypeFromFieldPath,
  GenericDataModel,
  GenericDatabaseReader,
  GenericIndexFields,
  GenericQueryCtx,
  GenericTableIndexes,
  IndexNames,
  Indexes,
  NamedIndex,
  NamedTableInfo,
  TableNamesInDataModel,
} from "convex/server";
import { GenericId } from "convex/values";
import { query as baseQuery } from "./_generated/server";
import { Doc, TableNames } from "./_generated/dataModel";
import { Expand } from "./schema";

type FieldTypes<
  DataModel extends GenericDataModel,
  Table extends TableNamesInDataModel<DataModel>,
  T extends string[]
> = {
  [K in keyof T]: FieldTypeFromFieldPath<
    DocumentByName<DataModel, Table>,
    T[K]
  >;
};

class QueryPromise<
  DataModel extends GenericDataModel,
  Table extends TableNamesInDataModel<DataModel>
> extends Promise<EntByName<DataModel, Table>[]> {
  constructor(private ctx: GenericQueryCtx<DataModel>, private table: Table) {
    super(() => {});
  }

  get<
    Indexes extends DataModel[Table]["indexes"],
    Index extends keyof Indexes,
    IndexTypes extends string[] = Indexes[Index]
  >(
    indexName: Index,
    ...values: FieldTypes<DataModel, Table, IndexTypes>
  ): QueryOnePromise<DataModel, Table>;
  get(id: GenericId<Table>): QueryOnePromise<DataModel, Table>;
  get(...args: any[]) {
    return new QueryOnePromise(
      this.ctx,
      args.length === 1
        ? (db) => {
            const id = args[0] as GenericId<Table>;
            if (this.ctx.db.normalizeId(this.table, id) === null) {
              return Promise.reject(
                new Error(`Invalid id \`${id}\` for table "${this.table}"`)
              );
            }
            return db
              .get(id)
              .then((doc) =>
                doc === null ? null : entWrapper(doc, this.table)
              );
          }
        : (db) => {
            const [indexName, value] = args;
            return db
              .query(this.table)
              .withIndex(indexName, (q) => q.eq(indexName, value))
              .unique()
              .then((doc) =>
                doc === null ? null : entWrapper(doc, this.table)
              );
          }
    );
  }

  first(): QueryOnePromise<DataModel, Table> {
    return new QueryOnePromise(this.ctx, (db) =>
      db
        .query(this.table)
        .first()
        .then((doc) => (doc === null ? null : entWrapper(doc, this.table)))
    );
  }

  then<TResult1 = EntByName<DataModel, Table>[], TResult2 = never>(
    onfulfilled?:
      | ((
          value: EntByName<DataModel, Table>[]
        ) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): Promise<TResult1 | TResult2> {
    return this.ctx.db
      .query(this.table)
      .collect()
      .then((documents) => documents.map((doc) => entWrapper(doc, this.table)))
      .then(onfulfilled, onrejected);
  }
}

class QueryOnePromise<
  DataModel extends GenericDataModel,
  Table extends TableNamesInDataModel<DataModel>
> extends Promise<EntByName<DataModel, Table> | null> {
  constructor(
    private ctx: GenericQueryCtx<DataModel>,
    private retrieve: (
      db: GenericDatabaseReader<DataModel>
    ) => Promise<EntByName<DataModel, Table> | null>
  ) {
    super(() => {});
  }

  then<TResult1 = EntByName<DataModel, Table> | null, TResult2 = never>(
    onfulfilled?:
      | ((
          value: EntByName<DataModel, Table> | null
        ) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): Promise<TResult1 | TResult2> {
    return this.retrieve(this.ctx.db).then(onfulfilled, onrejected);
  }
}

function entWrapper<
  DataModel extends GenericDataModel,
  TableName extends TableNamesInDataModel<DataModel>
>(
  doc: DocumentByName<DataModel, TableName>,
  tableName: TableName
): EntByName<DataModel, TableName> {
  Object.defineProperty(doc, "edge", {
    value: (name: string) => {},
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return doc as any;
}

function tableFactory<DataModel extends GenericDataModel>(
  ctx: GenericQueryCtx<DataModel>
) {
  return <Table extends TableNamesInDataModel<DataModel>>(table: Table) => {
    return new QueryPromise(ctx, table);
  };
}

const query = customQuery(
  baseQuery,
  customCtx(async (ctx) => {
    return {
      table: tableFactory(ctx),
      db: undefined,
    };
  })
);

type EntByName<
  DataModel extends GenericDataModel,
  TableName extends TableNamesInDataModel<DataModel>
> = Expand<DocumentByName<DataModel, TableName> & { myMethod(): null }>;

export const test = query({
  args: {},

  handler: async (ctx) => {
    {
      // const postsByUser = await ctx
      // .table("users")
      // .get("email", "srb@convex.dev")
      // // .edge("posts")
      // .map(async (user) => (
      //   ctx.table("posts")
      //     .withIndex("authorId", (q) => q.eq("authorId", user._id))
      // ));
    }
    {
      // const message = await ctx
      //   .table("messages")
      //   .get("authorId", "jh76hs45yga4pgptp21nxhfdx96gf8xr" as any);
      // return message;
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
