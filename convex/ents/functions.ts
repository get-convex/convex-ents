import {
  DocumentByName,
  ExpressionOrValue,
  FieldTypeFromFieldPath,
  FilterBuilder,
  GenericDataModel,
  GenericDatabaseReader,
  GenericQueryCtx,
  IndexNames,
  IndexRange,
  IndexRangeBuilder,
  NamedIndex,
  NamedSearchIndex,
  NamedTableInfo,
  PaginationOptions,
  PaginationResult,
  Query,
  QueryInitializer,
  SearchFilter,
  SearchFilterBuilder,
  SearchIndexNames,
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

interface PromiseOrderedQueryOrNull<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends Promise<EntByName<DataModel, EntsDataModel, Table>[] | null> {
  filter(
    predicate: (
      q: FilterBuilder<NamedTableInfo<DataModel, Table>>
    ) => ExpressionOrValue<boolean>
  ): this;

  map<TOutput>(
    callbackFn: (
      value: EntByName<DataModel, EntsDataModel, Table>,
      index: number,
      array: EntByName<DataModel, EntsDataModel, Table>[]
    ) => Promise<TOutput> | TOutput
  ): Promise<TOutput[] | null>;

  // TODO: entWrapper for pagination
  paginate(
    paginationOpts: PaginationOptions
  ): Promise<PaginationResult<DocumentByName<DataModel, Table>> | null>;

  take(n: number): PromiseEntsOrNullImpl<DataModel, EntsDataModel, Table>;

  first(): PromiseEntOrNull<DataModel, EntsDataModel, Table>;

  unique(): PromiseEntOrNull<DataModel, EntsDataModel, Table>;

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
  ): Promise<TResult1 | TResult2>;
}

interface PromiseQueryOrNull<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends PromiseOrderedQueryOrNull<DataModel, EntsDataModel, Table> {
  // TODO: The index variant should not be allowed if
  // this query already used an index
  order(
    order: "asc" | "desc",
    indexName?: IndexNames<NamedTableInfo<DataModel, Table>>
  ): PromiseOrderedQueryOrNull<DataModel, EntsDataModel, Table>;
}

interface PromiseTable<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends PromiseQuery<DataModel, EntsDataModel, Table> {
  get<Indexes extends DataModel[Table]["indexes"], Index extends keyof Indexes>(
    indexName: Index,
    // TODO: Figure out how to make this variadic
    value0: FieldTypeFromFieldPath<
      DocumentByName<DataModel, Table>,
      Indexes[Index][0]
    >
  ): PromiseEntOrNull<DataModel, EntsDataModel, Table>;
  get(id: GenericId<Table>): PromiseEntOrNull<DataModel, EntsDataModel, Table>;

  /**
   * Query by running a full text search against a search index.
   *
   * Search queries must always search for some text within the index's
   * `searchField`. This query can optionally add equality filters for any
   * `filterFields` specified in the index.
   *
   * Documents will be returned in relevance order based on how well they
   * match the search text.
   *
   * To learn about full text search, see [Indexes](https://docs.convex.dev/text-search).
   *
   * @param indexName - The name of the search index to query.
   * @param searchFilter - A search filter expression constructed with the
   * supplied {@link SearchFilterBuilder}. This defines the full text search to run
   * along with equality filtering to run within the search index.
   * @returns - A query that searches for matching documents, returning them
   * in relevancy order.
   */
  search<IndexName extends SearchIndexNames<NamedTableInfo<DataModel, Table>>>(
    indexName: IndexName,
    searchFilter: (
      q: SearchFilterBuilder<
        DocumentByName<DataModel, Table>,
        NamedSearchIndex<NamedTableInfo<DataModel, Table>, IndexName>
      >
    ) => SearchFilter
  ): PromiseOrderedQuery<DataModel, EntsDataModel, Table>;

  normalizeId(id: string): GenericId<Table> | null;
}

interface PromiseOrderedQuery<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends Promise<EntByName<DataModel, EntsDataModel, Table>[]> {
  filter(
    predicate: (
      q: FilterBuilder<NamedTableInfo<DataModel, Table>>
    ) => ExpressionOrValue<boolean>
  ): this;

  map<TOutput>(
    callbackFn: (
      value: EntByName<DataModel, EntsDataModel, Table>,
      index: number,
      array: EntByName<DataModel, EntsDataModel, Table>[]
    ) => Promise<TOutput> | TOutput
  ): Promise<TOutput[]>;

  // TODO: entWrapper for pagination
  paginate(
    paginationOpts: PaginationOptions
  ): Promise<PaginationResult<DocumentByName<DataModel, Table>>>;

  take(n: number): PromiseEnts<DataModel, EntsDataModel, Table>;

  first(): PromiseEntOrNull<DataModel, EntsDataModel, Table>;

  unique(): PromiseEntOrNull<DataModel, EntsDataModel, Table>;

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
  ): Promise<TResult1 | TResult2>;
}

interface PromiseQuery<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends PromiseOrderedQuery<DataModel, EntsDataModel, Table> {
  order(
    order: "asc" | "desc",
    indexName?: IndexNames<NamedTableInfo<DataModel, Table>>
  ): PromiseOrderedQuery<DataModel, EntsDataModel, Table>;
}

class PromiseQueryOrNullImpl<
    DataModel extends GenericDataModel,
    EntsDataModel extends GenericEntsDataModel<DataModel>,
    Table extends TableNamesInDataModel<DataModel>
  >
  extends Promise<EntByName<DataModel, EntsDataModel, Table>[] | null>
  implements PromiseQueryOrNull<DataModel, EntsDataModel, Table>
{
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
  ): any {
    return new PromiseQueryOrNullImpl(
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

  async map<TOutput>(
    callbackFn: (
      value: EntByName<DataModel, EntsDataModel, Table>,
      index: number,
      array: EntByName<DataModel, EntsDataModel, Table>[]
    ) => Promise<TOutput> | TOutput
  ) {
    const array = await this;
    if (array === null) {
      return [];
    }
    return await Promise.all(array.map(callbackFn));
  }

  order(
    order: "asc" | "desc",
    indexName?: IndexNames<NamedTableInfo<DataModel, Table>>
  ): any {
    return new PromiseQueryOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async (db) => {
        const query = await this.retrieve(db);
        if (query === null) {
          return null;
        }
        if (indexName !== undefined) {
          // TODO: We need more granular types for the QueryPromises
          return (query as QueryInitializer<NamedTableInfo<DataModel, Table>>)
            .withIndex(indexName)
            .order(order);
        }
        // TODO: We need more granular types for the QueryPromises
        return query.order(order) as any;
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

  take(n: number) {
    return new PromiseEntsOrNullImpl(
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

  first() {
    return new PromiseEntOrNullImpl(
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

  unique() {
    return new PromiseEntOrNullImpl(
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

class PromiseTableImpl<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends PromiseQueryOrNullImpl<DataModel, EntsDataModel, Table> {
  constructor(
    ctx: GenericQueryCtx<DataModel>,
    entDefinitions: EntsDataModel,
    table: Table
  ) {
    super(ctx, entDefinitions, table, async (db) => db.query(table));
  }

  get(...args: any[]) {
    return new PromiseEntOrNullImpl(
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

  withIndex(
    indexName: IndexNames<NamedTableInfo<DataModel, Table>>,
    indexRange?: (
      q: IndexRangeBuilder<
        DocumentByName<DataModel, Table>,
        NamedIndex<NamedTableInfo<DataModel, Table>, typeof indexName>
      >
    ) => IndexRange
  ) {
    return new PromiseQueryOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async (db) => {
        const query = await this.retrieve(db);
        return (
          query as QueryInitializer<NamedTableInfo<DataModel, Table>>
        ).withIndex(indexName, indexRange);
      }
    );
  }

  search<IndexName extends SearchIndexNames<NamedTableInfo<DataModel, Table>>>(
    indexName: IndexName,
    searchFilter: (
      q: SearchFilterBuilder<
        DocumentByName<DataModel, Table>,
        NamedSearchIndex<NamedTableInfo<DataModel, Table>, IndexName>
      >
    ) => SearchFilter
  ) {
    return new PromiseQueryOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async (db) => {
        const query = await this.retrieve(db);
        return (
          query as QueryInitializer<NamedTableInfo<DataModel, Table>>
        ).withSearchIndex(indexName, searchFilter) as any;
      }
    );
  }
}

// This query materializes objects, so chaining to this type of query performs one operation for each
// retrieved document in JavaScript, basically as if using
// `Promise.all()`.
interface PromiseEntsOrNull<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends Promise<EntByName<DataModel, EntsDataModel, Table>[] | null> {
  // This just returns the first retrieved document, it does not optimize
  // the previous steps in the query.
  first(): PromiseEntOrNull<DataModel, EntsDataModel, Table>;

  // This just returns the unique retrieved document, it does not optimize
  // the previous steps in the query. Otherwise it behaves like db.query().unique().
  unique(): PromiseEntOrNull<DataModel, EntsDataModel, Table>;
}

// This query materializes objects, so chaining to this type of query performs one operation for each
// retrieved document in JavaScript, basically as if using
// `Promise.all()`.
interface PromiseEnts<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends Promise<EntByName<DataModel, EntsDataModel, Table>[]> {
  // This just returns the first retrieved document, it does not optimize
  // the previous steps in the query.
  first(): PromiseEntOrNull<DataModel, EntsDataModel, Table>;

  // This just returns the unique retrieved document, it does not optimize
  // the previous steps in the query. Otherwise it behaves like db.query().unique().
  unique(): PromiseEntOrNull<DataModel, EntsDataModel, Table>;
}

class PromiseEntsOrNullImpl<
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

  first() {
    return new PromiseEntOrNullImpl(
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

  unique() {
    return new PromiseEntOrNullImpl(
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

interface PromiseEntOrNull<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends Promise<EntByName<DataModel, EntsDataModel, Table> | null> {
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
  ): Promise<TResult1 | TResult2>;

  edge<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge
  ): PromiseEdgeOrNull<DataModel, EntsDataModel, Table, Edge>;
}

interface PromiseEnt<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends Promise<EntByName<DataModel, EntsDataModel, Table>> {
  then<TResult1 = EntByName<DataModel, EntsDataModel, Table>, TResult2 = never>(
    onfulfilled?:
      | ((
          value: EntByName<DataModel, EntsDataModel, Table>
        ) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): Promise<TResult1 | TResult2>;

  edge<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge
  ): PromiseEdge<DataModel, EntsDataModel, Table, Edge>;
}

class PromiseEntOrNullImpl<
    DataModel extends GenericDataModel,
    EntsDataModel extends GenericEntsDataModel<DataModel>,
    Table extends TableNamesInDataModel<DataModel>
  >
  extends Promise<EntByName<DataModel, EntsDataModel, Table> | null>
  implements PromiseEntOrNull<DataModel, EntsDataModel, Table>
{
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

  edge<Edge extends keyof EntsDataModel[Table]["edges"]>(edge: Edge) {
    const edgeDefinition: EdgeConfig = (
      this.entDefinitions[this.table].edges as any
    ).filter(({ name }: EdgeConfig) => name === edge)[0];

    if (edgeDefinition.cardinality === "multiple") {
      if (edgeDefinition.type === "ref") {
        return new PromiseEntsOrNullImpl(
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
      return new PromiseQueryOrNullImpl(
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

    return new PromiseEntOrNullImpl(
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
  const queryInterface = new PromiseEntOrNullImpl(
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
  Object.entries((entDefinitions as any)[table].defaults).map(
    ([field, value]) => {
      if (doc[field] === undefined) {
        (doc as any)[field] = value;
      }
    }
  );
  return doc as any;
}

export function tableFactory<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>
>(
  ctx: GenericQueryCtx<DataModel>,
  entDefinitions: EntsDataModel
): TableFactory<DataModel, EntsDataModel> {
  return (
    table: TableNamesInDataModel<DataModel>,
    indexName?: string,
    indexRange?: any
  ) => {
    if (typeof table !== "string") {
      throw new Error(`Expected table name, got \`${table as any}\``);
    }
    const impl = new PromiseTableImpl(ctx, entDefinitions, table);
    if (indexName !== undefined) {
      return impl.withIndex(indexName, indexRange);
    }
    return impl as any;
  };
}

type TableFactory<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>
> = {
  <
    Table extends TableNamesInDataModel<DataModel>,
    IndexName extends IndexNames<NamedTableInfo<DataModel, Table>>
  >(
    table: Table,
    indexName: IndexName,
    indexRange?: (
      q: IndexRangeBuilder<
        DocumentByName<DataModel, Table>,
        NamedIndex<NamedTableInfo<DataModel, Table>, IndexName>
      >
    ) => IndexRange
  ): PromiseQuery<DataModel, EntsDataModel, Table>;
  <Table extends TableNamesInDataModel<DataModel>>(table: Table): PromiseTable<
    DataModel,
    EntsDataModel,
    Table
  >;
};

type EntByName<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> = Expand<
  DocumentByName<DataModel, Table> & {
    edge<Edge extends keyof EntsDataModel[Table]["edges"]>(
      edge: Edge
    ): PromiseEdge<DataModel, EntsDataModel, Table, Edge>;
  }
>;

type PromiseEdge<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>,
  Edge extends keyof EntsDataModel[Table]["edges"]
> = EntsDataModel[Table]["edges"][Edge]["cardinality"] extends "multiple"
  ? EntsDataModel[Table]["edges"][Edge]["type"] extends "ref"
    ? PromiseEnts<
        DataModel,
        EntsDataModel,
        EntsDataModel[Table]["edges"][Edge]["to"]
      >
    : PromiseQuery<
        DataModel,
        EntsDataModel,
        EntsDataModel[Table]["edges"][Edge]["to"]
      >
  : EntsDataModel[Table]["edges"][Edge]["type"] extends "ref"
  ? PromiseEntOrNull<
      DataModel,
      EntsDataModel,
      EntsDataModel[Table]["edges"][Edge]["to"]
    >
  : PromiseEnt<
      DataModel,
      EntsDataModel,
      EntsDataModel[Table]["edges"][Edge]["to"]
    >;

type PromiseEdgeOrNull<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>,
  Edge extends keyof EntsDataModel[Table]["edges"]
> = EntsDataModel[Table]["edges"][Edge]["cardinality"] extends "multiple"
  ? EntsDataModel[Table]["edges"][Edge]["type"] extends "ref"
    ? PromiseEntsOrNull<
        DataModel,
        EntsDataModel,
        EntsDataModel[Table]["edges"][Edge]["to"]
      >
    : PromiseQueryOrNull<
        DataModel,
        EntsDataModel,
        EntsDataModel[Table]["edges"][Edge]["to"]
      >
  : PromiseEntOrNull<
      DataModel,
      EntsDataModel,
      EntsDataModel[Table]["edges"][Edge]["to"]
    >;
