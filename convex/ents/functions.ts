import {
  DocumentByName,
  ExpressionOrValue,
  FieldTypeFromFieldPath,
  FilterBuilder,
  GenericDataModel,
  GenericDatabaseReader,
  GenericQueryCtx,
  NamedTableInfo,
  PaginationOptions,
  PaginationResult,
  Query,
  TableNamesInDataModel,
} from "convex/server";
import { GenericId } from "convex/values";
import { EdgeConfig, Expand, GenericEntsDataModel } from "./schema";

// TODO: Figure out how to make get() variadic
// type FieldTypes<
//   DataModel extends GenericDataModel,
//   Table extends TableNamesInDataModel<DataModel>,
//   T extends string[]
// > = {
//   [K in keyof T]: FieldTypeFromFieldPath<
//     DocumentByName<DataModel, Table>,
//     T[K]
//   >;
// };

class QueryQueryOrNullPromise<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends Promise<EntByName<DataModel, EntsDataModel, Table>[] | null> {
  constructor(
    protected ctx: GenericQueryCtx<DataModel>,
    protected entDefinitions: EntsDataModel,
    protected table: Table,
    protected retrieve: (
      db: GenericDatabaseReader<DataModel>
    ) => Promise<Query<NamedTableInfo<DataModel, Table>> | null>
  ) {
    super(() => {});
  }

  filter(
    predicate: (
      q: FilterBuilder<NamedTableInfo<DataModel, Table>>
    ) => ExpressionOrValue<boolean>
  ): QueryQueryOrNullPromise<DataModel, EntsDataModel, Table> {
    return new QueryQueryOrNullPromise(
      this.ctx,
      this.entDefinitions,
      this.table,
      async (db) => {
        const query = await this.retrieve(db);
        if (query === null) {
          return null;
        }
        return query.filter(predicate);
      }
    );
  }

  async paginate(
    paginationOpts: PaginationOptions
  ): Promise<PaginationResult<DocumentByName<DataModel, Table>> | null> {
    const query = await this.retrieve(this.ctx.db);
    if (query === null) {
      return null;
    }
    return await query.paginate(paginationOpts);
  }

  take(n: number): QueryMultipleOrNullPromise<DataModel, EntsDataModel, Table> {
    return new QueryMultipleOrNullPromise(
      this.ctx,
      this.entDefinitions,
      this.table,
      async (db) => {
        const query = await this.retrieve(db);
        if (query === null) {
          return null;
        }
        return query.take(n);
      }
    );
  }

  first(): QueryOnePromise<DataModel, EntsDataModel, Table> {
    return new QueryOnePromise(
      this.ctx,
      this.entDefinitions,
      this.table,
      async (db) => {
        const query = await this.retrieve(db);
        if (query === null) {
          return null;
        }
        return query.first();
      }
    );
  }

  unique(): QueryOnePromise<DataModel, EntsDataModel, Table> {
    return new QueryOnePromise(
      this.ctx,
      this.entDefinitions,
      this.table,
      async (db) => {
        const query = await this.retrieve(db);
        if (query === null) {
          return null;
        }
        return query.unique();
      }
    );
  }

  then<
    TResult1 = EntByName<DataModel, EntsDataModel, Table>[] | null,
    TResult2 = never
  >(
    onfulfilled?:
      | ((
          value: EntByName<DataModel, EntsDataModel, Table>[] | null
        ) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): Promise<TResult1 | TResult2> {
    return this.retrieve(this.ctx.db)
      .then((query) => (query === null ? null : query.collect()))
      .then((documents) =>
        documents === null
          ? null
          : documents.map((doc) =>
              entWrapper(doc, this.ctx, this.entDefinitions, this.table)
            )
      )
      .then(onfulfilled, onrejected);
  }
}

class QueryQueryPromise<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends Promise<EntByName<DataModel, EntsDataModel, Table>[]> {
  constructor(
    protected ctx: GenericQueryCtx<DataModel>,
    protected entDefinitions: EntsDataModel,
    protected table: Table,
    protected retrieve: (
      db: GenericDatabaseReader<DataModel>
    ) => Promise<Query<NamedTableInfo<DataModel, Table>>>
  ) {
    super(() => {});
  }

  async map<TOutput>(
    callbackFn: (
      value: EntByName<DataModel, EntsDataModel, Table>,
      index: number,
      array: EntByName<DataModel, EntsDataModel, Table>[]
    ) => Promise<TOutput> | TOutput
  ): Promise<TOutput[]> {
    const array = await this;
    return await Promise.all(array.map(callbackFn));
  }

  filter(
    predicate: (
      q: FilterBuilder<NamedTableInfo<DataModel, Table>>
    ) => ExpressionOrValue<boolean>
  ): QueryQueryPromise<DataModel, EntsDataModel, Table> {
    return new QueryQueryPromise(
      this.ctx,
      this.entDefinitions,
      this.table,
      async (db) => {
        const query = await this.retrieve(db);
        return query.filter(predicate);
      }
    );
  }

  async paginate(
    paginationOpts: PaginationOptions
  ): Promise<PaginationResult<DocumentByName<DataModel, Table>>> {
    const query = await this.retrieve(this.ctx.db);
    return await query.paginate(paginationOpts);
  }

  take(n: number): QueryMultiplePromise<DataModel, EntsDataModel, Table> {
    return new QueryMultiplePromise(
      this.ctx,
      this.entDefinitions,
      this.table,
      async (db) => {
        const query = await this.retrieve(db);
        return query.take(n);
      }
    );
  }

  first(): QueryOnePromise<DataModel, EntsDataModel, Table> {
    return new QueryOnePromise(
      this.ctx,
      this.entDefinitions,
      this.table,
      async (db) => {
        const query = await this.retrieve(db);
        return query.first();
      }
    );
  }

  unique(): QueryOnePromise<DataModel, EntsDataModel, Table> {
    return new QueryOnePromise(
      this.ctx,
      this.entDefinitions,
      this.table,
      async (db) => {
        const query = await this.retrieve(db);
        return query.unique();
      }
    );
  }

  then<
    TResult1 = EntByName<DataModel, EntsDataModel, Table>[],
    TResult2 = never
  >(
    onfulfilled?:
      | ((
          value: EntByName<DataModel, EntsDataModel, Table>[]
        ) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): Promise<TResult1 | TResult2> {
    return this.retrieve(this.ctx.db)
      .then((query) => query.collect())
      .then((documents) =>
        documents.map((doc) =>
          entWrapper(doc, this.ctx, this.entDefinitions, this.table)
        )
      )
      .then(onfulfilled, onrejected);
  }
}

class QueryPromise<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends QueryQueryPromise<DataModel, EntsDataModel, Table> {
  constructor(
    ctx: GenericQueryCtx<DataModel>,
    entDefinitions: EntsDataModel,
    table: Table
  ) {
    super(ctx, entDefinitions, table, async (db) => db.query(table));
  }

  get<Indexes extends DataModel[Table]["indexes"], Index extends keyof Indexes>(
    indexName: Index,
    // TODO: Figure out how to make this variadic
    value0: FieldTypeFromFieldPath<
      DocumentByName<DataModel, Table>,
      Indexes[Index][0]
    >
  ): QueryOnePromise<DataModel, EntsDataModel, Table>;
  get(id: GenericId<Table>): QueryOnePromise<DataModel, EntsDataModel, Table>;
  get(...args: any[]) {
    return new QueryOnePromise(
      this.ctx,
      this.entDefinitions,
      this.table,
      args.length === 1
        ? (db) => {
            const id = args[0] as GenericId<Table>;
            if (this.ctx.db.normalizeId(this.table, id) === null) {
              return Promise.reject(
                new Error(`Invalid id \`${id}\` for table "${this.table}"`)
              );
            }
            return db.get(id);
          }
        : (db) => {
            const [indexName, value] = args;
            return db
              .query(this.table)
              .withIndex(indexName, (q) => q.eq(indexName, value))
              .unique();
          }
    );
  }

  normalizeId(id: string): GenericId<Table> | null {
    return this.ctx.db.normalizeId(this.table, id);
  }
}

// This query materializes objects, so chaining to this type of query performs one operation for each
// retrieved document in JavaScript, basically as if using
// `Promise.all()`.
class QueryMultipleOrNullPromise<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends Promise<EntByName<DataModel, EntsDataModel, Table>[] | null> {
  constructor(
    private ctx: GenericQueryCtx<DataModel>,
    private entDefinitions: EntsDataModel,
    private table: Table,
    private retrieve: (
      db: GenericDatabaseReader<DataModel>
    ) => Promise<DocumentByName<DataModel, Table>[] | null>
  ) {
    super(() => {});
  }

  // This just returns the first retrieved document, it does not optimize
  // the previous steps in the query.
  first(): QueryOnePromise<DataModel, EntsDataModel, Table> {
    return new QueryOnePromise(
      this.ctx,
      this.entDefinitions,
      this.table,
      async (db) => {
        const docs = await this.retrieve(db);
        if (docs === null) {
          return null;
        }
        return docs[0] ?? null;
      }
    );
  }

  // This just returns the unique retrieved document, it does not optimize
  // the previous steps in the query. It behaves like db.query().unique()
  unique(): QueryOnePromise<DataModel, EntsDataModel, Table> {
    return new QueryOnePromise(
      this.ctx,
      this.entDefinitions,
      this.table,
      async (db) => {
        const docs = await this.retrieve(db);
        if (docs === null) {
          return null;
        }
        if (docs.length === 2) {
          throw new Error("unique() query returned more than one result");
        }
        return docs[0] ?? null;
      }
    );
  }

  then<
    TResult1 = EntByName<DataModel, EntsDataModel, Table>[] | null,
    TResult2 = never
  >(
    onfulfilled?:
      | ((
          value: EntByName<DataModel, EntsDataModel, Table>[] | null
        ) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): Promise<TResult1 | TResult2> {
    return this.retrieve(this.ctx.db)
      .then((docs) =>
        docs === null
          ? null
          : docs.map((doc) =>
              entWrapper(doc, this.ctx, this.entDefinitions, this.table)
            )
      )
      .then(onfulfilled, onrejected);
  }
}

// This query materializes objects, so chaining to this type of query performs one operation for each
// retrieved document in JavaScript, basically as if using
// `Promise.all()`.
class QueryMultiplePromise<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends Promise<EntByName<DataModel, EntsDataModel, Table>[]> {
  constructor(
    private ctx: GenericQueryCtx<DataModel>,
    private entDefinitions: EntsDataModel,
    private table: Table,
    private retrieve: (
      db: GenericDatabaseReader<DataModel>
    ) => Promise<DocumentByName<DataModel, Table>[]>
  ) {
    super(() => {});
  }

  // This just returns the first retrieved document, it does not optimize
  // the previous steps in the query.
  first(): QueryOnePromise<DataModel, EntsDataModel, Table> {
    return new QueryOnePromise(
      this.ctx,
      this.entDefinitions,
      this.table,
      async (db) => {
        const docs = await this.retrieve(db);
        return docs[0] ?? null;
      }
    );
  }

  // This just returns the unique retrieved document, it does not optimize
  // the previous steps in the query. It behaves like db.query().unique()
  unique(): QueryOnePromise<DataModel, EntsDataModel, Table> {
    return new QueryOnePromise(
      this.ctx,
      this.entDefinitions,
      this.table,
      async (db) => {
        const docs = await this.retrieve(db);
        if (docs.length === 2) {
          throw new Error("unique() query returned more than one result");
        }
        return docs[0] ?? null;
      }
    );
  }

  then<
    TResult1 = EntByName<DataModel, EntsDataModel, Table>[],
    TResult2 = never
  >(
    onfulfilled?:
      | ((
          value: EntByName<DataModel, EntsDataModel, Table>[]
        ) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): Promise<TResult1 | TResult2> {
    return this.retrieve(this.ctx.db)
      .then((docs) =>
        docs.map((doc) =>
          entWrapper(doc, this.ctx, this.entDefinitions, this.table)
        )
      )
      .then(onfulfilled, onrejected);
  }
}

class QueryOnePromise<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends Promise<EntByName<DataModel, EntsDataModel, Table> | null> {
  constructor(
    private ctx: GenericQueryCtx<DataModel>,
    private entDefinitions: EntsDataModel,
    private table: Table,
    private retrieve: (
      db: GenericDatabaseReader<DataModel>
    ) => Promise<DocumentByName<DataModel, Table> | null>
  ) {
    super(() => {});
  }

  then<
    TResult1 = EntByName<DataModel, EntsDataModel, Table> | null,
    TResult2 = never
  >(
    onfulfilled?:
      | ((
          value: EntByName<DataModel, EntsDataModel, Table> | null
        ) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): Promise<TResult1 | TResult2> {
    return this.retrieve(this.ctx.db)
      .then((doc) =>
        doc === null
          ? null
          : entWrapper(doc, this.ctx, this.entDefinitions, this.table)
      )
      .then(onfulfilled, onrejected);
  }

  edge<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge
  ): EntsDataModel[Table]["edges"][Edge]["cardinality"] extends "multiple"
    ? EntsDataModel[Table]["edges"][Edge]["type"] extends "ref"
      ? QueryMultipleOrNullPromise<
          DataModel,
          EntsDataModel,
          EntsDataModel[Table]["edges"][Edge]["to"]
        >
      : QueryQueryOrNullPromise<
          DataModel,
          EntsDataModel,
          EntsDataModel[Table]["edges"][Edge]["to"]
        >
    : QueryOnePromise<
        DataModel,
        EntsDataModel,
        EntsDataModel[Table]["edges"][Edge]["to"]
      > {
    const edgeDefinition: EdgeConfig = (
      this.entDefinitions[this.table].edges as any
    ).filter(({ name }: EdgeConfig) => name === edge)[0];

    if (edgeDefinition.cardinality === "multiple") {
      if (edgeDefinition.type === "ref") {
        return new QueryMultipleOrNullPromise(
          this.ctx,
          this.entDefinitions,
          edgeDefinition.to,
          async (db) => {
            const doc = await this.retrieve(db);
            if (doc === null) {
              return null;
            }
            const edgeDocs = await db
              .query(edgeDefinition.table)
              .withIndex(edgeDefinition.field, (q) =>
                q.eq(edgeDefinition.field, doc._id as any)
              )
              .collect();
            return (
              await Promise.all(
                edgeDocs.map((edgeDoc) =>
                  db.get(edgeDoc[edgeDefinition.ref] as any)
                )
              )
            ).filter(<TValue>(doc: TValue | null, i: number): doc is TValue => {
              if (doc === null) {
                throw new Error(
                  `Dangling reference "${
                    edgeDocs[i][edgeDefinition.field] as string
                  }" found in document with _id "${
                    edgeDocs[i]._id as string
                  }", expected to find a document with the first ID.`
                );
              }
              return true;
            });
          }
        ) as any;
      }
      return new QueryQueryOrNullPromise(
        this.ctx,
        this.entDefinitions,
        edgeDefinition.to,
        async (db) => {
          const doc = await this.retrieve(db);
          if (doc === null) {
            return null;
          }
          return db
            .query(edgeDefinition.to)
            .withIndex(edgeDefinition.ref, (q) =>
              q.eq(edgeDefinition.ref, doc._id as any)
            );
        }
      ) as any;
    }

    return new QueryOnePromise(
      this.ctx,
      this.entDefinitions,
      edgeDefinition.to,
      async (db) => {
        const doc = await this.retrieve(db);
        if (doc === null) {
          return null;
        }

        if (edgeDefinition.type === "ref") {
          const inverseEdgeDefinition: EdgeConfig = (
            this.entDefinitions[edgeDefinition.to].edges as any
          ).filter(({ to }: EdgeConfig) => to === this.table)[0];
          if (inverseEdgeDefinition.type !== "field") {
            throw new Error(
              `Unexpected inverse edge type for edge: ${edgeDefinition.name}, ` +
                `expected field, got ${inverseEdgeDefinition.type} ` +
                `named ${inverseEdgeDefinition.name}`
            );
          }

          return await this.ctx.db
            .query(edgeDefinition.to)
            .withIndex(edgeDefinition.ref, (q) =>
              q.eq(edgeDefinition.ref, doc._id as any)
            )
            .unique();
        }

        return await this.ctx.db.get(doc[edgeDefinition.field] as any);
      }
    ) as any;
  }
}

function entWrapper<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
>(
  doc: DocumentByName<DataModel, Table>,
  ctx: GenericQueryCtx<DataModel>,
  entDefinitions: EntsDataModel,
  table: Table
): EntByName<DataModel, EntsDataModel, Table> {
  const queryInterface = new QueryOnePromise(
    ctx,
    entDefinitions,
    table,
    async () => doc
  );
  Object.defineProperty(doc, "edge", {
    value: (edge: any) => {
      return queryInterface.edge(edge);
    },
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return doc as any;
}

export function tableFactory<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>
>(ctx: GenericQueryCtx<DataModel>, entDefinitions: EntsDataModel) {
  return <Table extends TableNamesInDataModel<DataModel>>(table: Table) => {
    if (typeof table !== "string") {
      throw new Error(`Expected table name, got \`${table as any}\``);
    }
    return new QueryPromise(ctx, entDefinitions, table);
  };
}

type EntByName<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> = Expand<
  DocumentByName<DataModel, Table> & {
    edge<Edge extends keyof EntsDataModel[Table]["edges"]>(
      edge: Edge
    ): EdgeQuery<DataModel, EntsDataModel, Table, Edge>;
  }
>;

type EdgeQuery<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>,
  Edge extends keyof EntsDataModel[Table]["edges"]
> = EntsDataModel[Table]["edges"][Edge]["cardinality"] extends "multiple"
  ? QueryMultipleOrNullPromise<
      DataModel,
      EntsDataModel,
      EntsDataModel[Table]["edges"][Edge]["to"]
    >
  : QueryOnePromise<
      DataModel,
      EntsDataModel,
      EntsDataModel[Table]["edges"][Edge]["to"]
    >;
