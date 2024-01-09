import {
  DocumentByName,
  ExpressionOrValue,
  FieldTypeFromFieldPath,
  FilterBuilder,
  GenericDataModel,
  GenericDocument,
  GenericMutationCtx,
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
  WithOptionalSystemFields,
  WithoutSystemFields,
} from "convex/server";
import { GenericId } from "convex/values";
import { EdgeConfig, Expand, GenericEntsDataModel } from "./schema";
import {
  EdgeChanges,
  WithEdgePatches,
  WithEdges,
  WriterImplBase,
} from "./writer";

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
> extends Promise<
    | Ent<Table, DocumentByName<DataModel, Table>, DataModel, EntsDataModel>[]
    | null
  > {
  filter(
    predicate: (
      q: FilterBuilder<NamedTableInfo<DataModel, Table>>
    ) => ExpressionOrValue<boolean>
  ): this;

  map<TOutput>(
    callbackFn: (
      value: Ent<
        Table,
        DocumentByName<DataModel, Table>,
        DataModel,
        EntsDataModel
      >,
      index: number,
      array: Ent<
        Table,
        DocumentByName<DataModel, Table>,
        DataModel,
        EntsDataModel
      >[]
    ) => Promise<TOutput> | TOutput
  ): Promise<TOutput[] | null>;

  // TODO: entWrapper for pagination
  paginate(
    paginationOpts: PaginationOptions
  ): Promise<PaginationResult<DocumentByName<DataModel, Table>> | null>;

  take(n: number): PromiseEntsOrNull<DataModel, EntsDataModel, Table>;

  first(): PromiseEntOrNull<DataModel, EntsDataModel, Table>;

  unique(): PromiseEntOrNull<DataModel, EntsDataModel, Table>;
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

interface PromiseTableBase<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> {
  get<Indexes extends DataModel[Table]["indexes"], Index extends keyof Indexes>(
    indexName: Index,
    // TODO: Figure out how to make this variadic
    value0: FieldTypeFromFieldPath<
      DocumentByName<DataModel, Table>,
      Indexes[Index][0]
    >
  ): PromiseEntOrNull<DataModel, EntsDataModel, Table>;
  get(id: GenericId<Table>): PromiseEntOrNull<DataModel, EntsDataModel, Table>;

  getMany<
    Indexes extends DataModel[Table]["indexes"],
    Index extends keyof Indexes
  >(
    indexName: Index,
    values: FieldTypeFromFieldPath<
      DocumentByName<DataModel, Table>,
      Indexes[Index][0]
    >[]
  ): PromiseEntsOrNulls<DataModel, EntsDataModel, Table>;
  getMany(
    ids: GenericId<Table>[]
  ): PromiseEntsOrNulls<DataModel, EntsDataModel, Table>;

  getManyX<
    Indexes extends DataModel[Table]["indexes"],
    Index extends keyof Indexes
  >(
    indexName: Index,
    values: FieldTypeFromFieldPath<
      DocumentByName<DataModel, Table>,
      Indexes[Index][0]
    >[]
  ): PromiseEnts<DataModel, EntsDataModel, Table>;
  getManyX(
    ids: GenericId<Table>[]
  ): PromiseEnts<DataModel, EntsDataModel, Table>;

  /**
   * Returns the string ID format for the ID in a given table, or null if the ID
   * is from a different table or is not a valid ID.
   *
   * This does not guarantee that the ID exists (i.e. `table("foo").get(id)` may return `null`).
   *
   * @param tableName - The name of the table.
   * @param id - The ID string.
   */
  normalizeId(id: string): GenericId<Table> | null;
}

interface PromiseTable<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends PromiseQuery<DataModel, EntsDataModel, Table>,
    PromiseTableBase<DataModel, EntsDataModel, Table> {
  /**
   * Fetch a document from the DB using given index, throw if it doesn't exist.
   */
  getX<
    Indexes extends DataModel[Table]["indexes"],
    Index extends keyof Indexes
  >(
    indexName: Index,
    // TODO: Figure out how to make this variadic
    value0: FieldTypeFromFieldPath<
      DocumentByName<DataModel, Table>,
      Indexes[Index][0]
    >
  ): PromiseEnt<DataModel, EntsDataModel, Table>;
  /**
   * Fetch a document from the DB for a given ID, throw if it doesn't exist.
   */
  getX(id: GenericId<Table>): PromiseEnt<DataModel, EntsDataModel, Table>;

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
}

interface PromiseOrderedQueryBase<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> {
  filter(
    predicate: (
      q: FilterBuilder<NamedTableInfo<DataModel, Table>>
    ) => ExpressionOrValue<boolean>
  ): this;

  // TODO: entWrapper for pagination
  paginate(
    paginationOpts: PaginationOptions
  ): Promise<PaginationResult<DocumentByName<DataModel, Table>>>;

  first(): PromiseEntOrNull<DataModel, EntsDataModel, Table>;

  unique(): PromiseEntOrNull<DataModel, EntsDataModel, Table>;
}

interface PromiseOrderedQuery<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends Promise<
      Ent<Table, DocumentByName<DataModel, Table>, DataModel, EntsDataModel>[]
    >,
    PromiseOrderedQueryBase<DataModel, EntsDataModel, Table> {
  map<TOutput>(
    callbackFn: (
      value: Ent<
        Table,
        DocumentByName<DataModel, Table>,
        DataModel,
        EntsDataModel
      >,
      index: number,
      array: Ent<
        Table,
        DocumentByName<DataModel, Table>,
        DataModel,
        EntsDataModel
      >[]
    ) => Promise<TOutput> | TOutput
  ): Promise<TOutput[]>;

  take(n: number): PromiseEnts<DataModel, EntsDataModel, Table>;

  firstX(): PromiseEnt<DataModel, EntsDataModel, Table>;

  uniqueX(): PromiseEnt<DataModel, EntsDataModel, Table>;
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
  extends Promise<
    | Ent<Table, DocumentByName<DataModel, Table>, DataModel, EntsDataModel>[]
    | null
  >
  implements PromiseQueryOrNull<DataModel, EntsDataModel, Table>
{
  constructor(
    protected ctx: GenericQueryCtx<DataModel>,
    protected entDefinitions: EntsDataModel,
    protected table: Table,
    protected retrieve: () => Promise<Query<
      NamedTableInfo<DataModel, Table>
    > | null>
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
      async () => {
        const query = await this.retrieve();
        if (query === null) {
          return null;
        }
        return query.filter(predicate);
      }
    );
  }

  async map<TOutput>(
    callbackFn: (
      value: Ent<
        Table,
        DocumentByName<DataModel, Table>,
        DataModel,
        EntsDataModel
      >,
      index: number,
      array: Ent<
        Table,
        DocumentByName<DataModel, Table>,
        DataModel,
        EntsDataModel
      >[]
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
      async () => {
        const query = await this.retrieve();
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
    const query = await this.retrieve();
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
      async () => {
        const query = await this.retrieve();
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
      async () => {
        const query = await this.retrieve();
        if (query === null) {
          return nullRetriever;
        }
        return loadedRetriever(await query.first());
      }
    );
  }

  firstX() {
    return new PromiseEntOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const query = await this.retrieve();
        if (query === null) {
          return nullRetriever;
        }
        const doc = await query.first();
        if (doc === null) {
          throw new Error("Query returned no documents");
        }
        return loadedRetriever(doc);
      }
    );
  }

  unique() {
    return new PromiseEntOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const query = await this.retrieve();
        if (query === null) {
          return nullRetriever;
        }
        return loadedRetriever(await query.unique());
      }
    );
  }

  uniqueX() {
    return new PromiseEntOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const query = await this.retrieve();
        if (query === null) {
          return nullRetriever;
        }
        const doc = await query.unique();
        if (doc === null) {
          throw new Error("Query returned no documents");
        }
        return loadedRetriever(doc);
      }
    );
  }

  then<
    TResult1 =
      | Ent<Table, DocumentByName<DataModel, Table>, DataModel, EntsDataModel>[]
      | null,
    TResult2 = never
  >(
    onfulfilled?:
      | ((
          value:
            | Ent<
                Table,
                DocumentByName<DataModel, Table>,
                DataModel,
                EntsDataModel
              >[]
            | null
        ) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): Promise<TResult1 | TResult2> {
    return this.retrieve()
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

export class PromiseTableImpl<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends PromiseQueryOrNullImpl<DataModel, EntsDataModel, Table> {
  constructor(
    ctx: GenericQueryCtx<DataModel>,
    entDefinitions: EntsDataModel,
    table: Table
  ) {
    super(ctx, entDefinitions, table, async () => ctx.db.query(table));
  }

  get(...args: any[]) {
    return this.getImpl(args);
  }

  getX(...args: any[]) {
    return this.getImpl(args, true);
  }

  getMany(...args: any[]) {
    return this.getManyImpl(args);
  }

  getManyX(...args: any[]) {
    return this.getManyImpl(args, true);
  }

  getImpl(args: any[], throwIfNull = false) {
    return new PromiseEntWriterImpl(
      this.ctx as any,
      this.entDefinitions as any,
      this.table,
      args.length === 1
        ? async () => {
            const id = args[0] as GenericId<Table>;
            if (this.ctx.db.normalizeId(this.table, id) === null) {
              throw new Error(`Invalid id \`${id}\` for table "${this.table}"`);
            }
            return {
              id,
              doc: async () => {
                const doc = await this.ctx.db.get(id);
                if (throwIfNull && doc === null) {
                  throw new Error(
                    `Document not found with id \`${id}\` in table "${this.table}"`
                  );
                }
                return doc;
              },
            } as any; // any because PromiseEntWriterImpl expects non-nullable
          }
        : async () => {
            const [indexName, value] = args;
            const doc = await this.ctx.db
              .query(this.table)
              .withIndex(indexName, (q) => q.eq(indexName, value))
              .unique();
            if (throwIfNull && doc === null) {
              throw new Error(
                `Table "${this.table}" does not contain document with field "${indexName}" = \`${value}\``
              );
            }
            return {
              id: doc?._id as GenericId<Table> | null,
              doc: async () => doc,
            } as any; // any because PromiseEntWriterImpl expects non-nullable
          }
    );
  }

  getManyImpl(args: any[], throwIfNull = false) {
    return new PromiseEntsOrNullImpl(
      this.ctx as any,
      this.entDefinitions as any,
      this.table,
      args.length === 1
        ? async () => {
            const ids = args[0] as GenericId<Table>[];
            ids.forEach((id) => {
              if (this.ctx.db.normalizeId(this.table, id) === null) {
                throw new Error(
                  `Invalid id \`${id}\` for table "${this.table}"`
                );
              }
            });
            return await Promise.all(
              ids.map(async (id) => {
                const doc = await this.ctx.db.get(id);
                if (doc === null) {
                  throw new Error(
                    `Document not found with id \`${id}\` in table "${this.table}"`
                  );
                }
                return doc;
              })
            );
          }
        : async () => {
            const [indexName, values] = args;
            return (await Promise.all(
              (values as any[]).map(async (value) => {
                const doc = await this.ctx.db
                  .query(this.table)
                  .withIndex(indexName, (q) => q.eq(indexName, value))
                  .unique();
                if (throwIfNull && doc === null) {
                  throw new Error(
                    `Table "${this.table}" does not contain document with field "${indexName}" = \`${value}\``
                  );
                }
                return doc;
              })
            )) as any;
          }
    );
  }

  normalizeId(id: string): GenericId<Table> | null {
    return this.ctx.db.normalizeId(this.table, id);
  }

  // normalizeId or throw
  normalizeIdX(id: string): GenericId<Table> {
    const normalized = this.normalizeId(id);
    if (normalized === null) {
      throw new Error(`Invalid id \`${id}\` for table "${this.table}"`);
    }
    return normalized;
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
      async () => {
        const query = await this.retrieve();
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
      async () => {
        const query = await this.retrieve();
        return (
          query as QueryInitializer<NamedTableInfo<DataModel, Table>>
        ).withSearchIndex(indexName, searchFilter) as any;
      }
    );
  }
}

// This lazy promise materializes objects, so chaining to this type of
// lazy promise performs one operation for each
// retrieved document in JavaScript, basically as if using `Promise.all()`.
interface PromiseEntsOrNull<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends Promise<
    | Ent<Table, DocumentByName<DataModel, Table>, DataModel, EntsDataModel>[]
    | null
  > {
  // TODO: At this point there is nothing query specific here, and we can either:
  //   1. Return a generic lazy promise of the list.
  //   2. Not give any methods, because they might lead devs down the wrong path.
  // // This just returns the first retrieved document, it does not optimize
  // // the previous steps in the query.
  // first(): PromiseEntOrNull<DataModel, EntsDataModel, Table>;
  // // This just returns the unique retrieved document, it does not optimize
  // // the previous steps in the query. Otherwise it behaves like db.query().unique().
  // unique(): PromiseEntOrNull<DataModel, EntsDataModel, Table>;
}

// This lazy promise materializes objects, so chaining to this type of
// lazy promise performs one operation for each
// retrieved document in JavaScript, basically as if using
// `Promise.all()`.
interface PromiseEnts<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends Promise<
    Ent<Table, DocumentByName<DataModel, Table>, DataModel, EntsDataModel>[]
  > {
  // TODO: At this point there is nothing query specific here, and we can either:
  //   1. Return a generic lazy promise of the list.
  //   2. Not give any methods, because they might lead devs down the wrong path.
  // // This just returns the first retrieved document, it does not optimize
  // // the previous steps in the query.
  // first(): PromiseEntOrNull<DataModel, EntsDataModel, Table>;
  // // This just returns the first retrieved document, or throws if there
  // // are no documents. It does not optimize the previous steps in the query.
  // firstX(): PromiseEnt<DataModel, EntsDataModel, Table>;
  // // This just returns the unique retrieved document, it does not optimize
  // // the previous steps in the query. Otherwise it behaves like db.query().unique().
  // unique(): PromiseEntOrNull<DataModel, EntsDataModel, Table>;
  // // This just returns the unique retrieved document, or throws if there
  // // are no documents. It does not optimize the previous steps in the query.
  // // Otherwise it behaves like db.query().unique().
  // uniqueX(): PromiseEnt<DataModel, EntsDataModel, Table>;
}

class PromiseEntsOrNullImpl<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends Promise<
  | Ent<Table, DocumentByName<DataModel, Table>, DataModel, EntsDataModel>[]
  | null
> {
  constructor(
    private ctx: GenericQueryCtx<DataModel>,
    private entDefinitions: EntsDataModel,
    private table: Table,
    private retrieve: () => Promise<DocumentByName<DataModel, Table>[] | null>
  ) {
    super(() => {});
  }

  first() {
    return new PromiseEntOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const docs = await this.retrieve();
        if (docs === null) {
          return nullRetriever;
        }
        return loadedRetriever(docs[0] ?? null);
      }
    );
  }

  firstX() {
    return new PromiseEntOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const docs = await this.retrieve();
        if (docs === null) {
          return nullRetriever;
        }
        const doc = docs[0] ?? null;
        if (doc === null) {
          throw new Error("Query returned no documents");
        }
        return loadedRetriever(doc);
      }
    );
  }

  unique() {
    return new PromiseEntOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const docs = await this.retrieve();
        if (docs === null) {
          return nullRetriever;
        }
        if (docs.length > 1) {
          throw new Error("unique() query returned more than one result");
        }
        return loadedRetriever(docs[0] ?? null);
      }
    );
  }

  uniqueX() {
    return new PromiseEntOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const docs = await this.retrieve();
        if (docs === null) {
          return nullRetriever;
        }
        if (docs.length > 1) {
          throw new Error("unique() query returned more than one result");
        }
        if (docs.length < 1) {
          throw new Error("unique() query returned no documents");
        }
        return loadedRetriever(docs[0]);
      }
    );
  }

  then<
    TResult1 =
      | Ent<Table, DocumentByName<DataModel, Table>, DataModel, EntsDataModel>[]
      | null,
    TResult2 = never
  >(
    onfulfilled?:
      | ((
          value:
            | Ent<
                Table,
                DocumentByName<DataModel, Table>,
                DataModel,
                EntsDataModel
              >[]
            | null
        ) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): Promise<TResult1 | TResult2> {
    return this.retrieve()
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

// This lazy promise materializes objects, so chaining to this type of
// lazy promise performs one operation for each
// retrieved document in JavaScript, basically as if using
// `Promise.all()`.
interface PromiseEntsOrNulls<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends Promise<
    (Ent<
      Table,
      DocumentByName<DataModel, Table>,
      DataModel,
      EntsDataModel
    > | null)[]
  > {}

interface PromiseEdgeEntsOrNull<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends PromiseEntsOrNull<DataModel, EntsDataModel, Table> {
  /**
   * Returns whether there is an ent with given ID on the other side
   * the edge. Returns null if chained to a null result.
   * @param id The ID of the ent on the other end of the edge
   */
  has(id: GenericId<Table>): Promise<boolean | null>;
}

interface PromiseEdgeEnts<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends PromiseEnts<DataModel, EntsDataModel, Table> {
  /**
   * Returns whether there is an ent with given ID on the other side
   * the edge.
   * @param id The ID of the ent on the other end of the edge
   */
  has(id: GenericId<Table>): Promise<boolean>;
}

class PromiseEdgeOrNullImpl<
    DataModel extends GenericDataModel,
    EntsDataModel extends GenericEntsDataModel<DataModel>,
    Table extends TableNamesInDataModel<DataModel>
  >
  extends PromiseEntsOrNullImpl<DataModel, EntsDataModel, Table>
  implements PromiseEdgeEntsOrNull<DataModel, EntsDataModel, Table>
{
  constructor(
    ctx: GenericQueryCtx<DataModel>,
    entDefinitions: EntsDataModel,
    table: Table,
    private field: string,
    private retrieveRange: (
      indexRange: (
        q: IndexRangeBuilder<DocumentByName<DataModel, Table>, any>
      ) => any
    ) => Promise<DocumentByName<DataModel, Table>[] | null>
  ) {
    super(ctx, entDefinitions, table, () => retrieveRange((q) => q));
  }

  async has(id: GenericId<Table>) {
    const docs = await this.retrieveRange((q) => q.eq(this.field, id as any));
    return (docs?.length ?? 0) > 0;
  }
}

export interface PromiseEntOrNull<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends Promise<Ent<
    Table,
    DocumentByName<DataModel, Table>,
    DataModel,
    EntsDataModel
  > | null> {
  edge<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge
  ): PromiseEdgeOrNull<DataModel, EntsDataModel, Table, Edge>;
}

export interface PromiseEnt<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends Promise<
    Ent<Table, DocumentByName<DataModel, Table>, DataModel, EntsDataModel>
  > {
  edge<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge
  ): PromiseEdge<DataModel, EntsDataModel, Table, Edge>;

  edgeX<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge
  ): PromiseEdgeOrThrow<DataModel, EntsDataModel, Table, Edge>;
}

export class PromiseEntOrNullImpl<
    DataModel extends GenericDataModel,
    EntsDataModel extends GenericEntsDataModel<DataModel>,
    Table extends TableNamesInDataModel<DataModel>
  >
  extends Promise<Ent<
    Table,
    DocumentByName<DataModel, Table>,
    DataModel,
    EntsDataModel
  > | null>
  implements PromiseEntOrNull<DataModel, EntsDataModel, Table>
{
  constructor(
    protected ctx: GenericQueryCtx<DataModel>,
    protected entDefinitions: EntsDataModel,
    protected table: Table,
    protected retrieve: DocRetriever<
      GenericId<Table> | null,
      DocumentByName<DataModel, Table> | null
    >
  ) {
    super(() => {});
  }

  then<
    TResult1 = Ent<
      Table,
      DocumentByName<DataModel, Table>,
      DataModel,
      EntsDataModel
    > | null,
    TResult2 = never
  >(
    onfulfilled?:
      | ((
          value: Ent<
            Table,
            DocumentByName<DataModel, Table>,
            DataModel,
            EntsDataModel
          > | null
        ) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): Promise<TResult1 | TResult2> {
    return this.retrieve()
      .then(({ id, doc }) => (id === null ? null : doc()))
      .then((doc) =>
        doc === null
          ? null
          : entWrapper(doc, this.ctx, this.entDefinitions, this.table)
      )
      .then(onfulfilled, onrejected);
  }

  edge<Edge extends keyof EntsDataModel[Table]["edges"]>(edge: Edge) {
    return this.edgeImpl(edge);
  }

  edgeX<Edge extends keyof EntsDataModel[Table]["edges"]>(edge: Edge) {
    return this.edgeImpl(edge, true);
  }

  edgeImpl<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge,
    throwIfNull = false
  ) {
    const edgeDefinition: EdgeConfig = (
      this.entDefinitions[this.table].edges as EntsDataModel[Table]["edges"]
    )[edge] as any;

    if (edgeDefinition.cardinality === "multiple") {
      if (edgeDefinition.type === "ref") {
        return new PromiseEdgeOrNullImpl(
          this.ctx,
          this.entDefinitions,
          edgeDefinition.to,
          edgeDefinition.ref,
          async (indexRange) => {
            const { id } = await this.retrieve();
            if (id === null) {
              return null;
            }
            const edgeDocs = await this.ctx.db
              .query(edgeDefinition.table)
              .withIndex(edgeDefinition.field, (q) =>
                indexRange(q.eq(edgeDefinition.field, id as any) as any)
              )
              .collect();
            return (
              await Promise.all(
                edgeDocs.map((edgeDoc) =>
                  this.ctx.db.get(edgeDoc[edgeDefinition.ref] as any)
                )
              )
            ).filter(<TValue>(doc: TValue | null, i: number): doc is TValue => {
              if (doc === null) {
                throw new Error(
                  `Dangling reference "${
                    edgeDocs[i][edgeDefinition.field] as string
                  }" found in edge document with ID "${
                    edgeDocs[i]._id as string
                  }", expected to find a document with the first ID in table ${
                    edgeDefinition.to
                  }.`
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
        async () => {
          const { id } = await this.retrieve();
          if (id === null) {
            return null;
          }
          return this.ctx.db
            .query(edgeDefinition.to)
            .withIndex(edgeDefinition.ref, (q) =>
              q.eq(edgeDefinition.ref, id as any)
            );
        }
      ) as any;
    }

    return new PromiseEntOrNullImpl(
      this.ctx,
      this.entDefinitions,
      edgeDefinition.to,
      async () => {
        const { id, doc: getDoc } = await this.retrieve();
        if (id === null) {
          return nullRetriever;
        }

        if (edgeDefinition.type === "ref") {
          const otherDoc = await this.ctx.db
            .query(edgeDefinition.to)
            .withIndex(edgeDefinition.ref, (q) =>
              q.eq(edgeDefinition.ref, id as any)
            )
            .unique();
          if (throwIfNull && otherDoc === null) {
            throw new Error(
              `Edge "${
                edgeDefinition.name
              }" does not exist for document with ID ${id as string}`
            );
          }
          return loadedRetriever(otherDoc);
        }
        const doc = (await getDoc())!;
        const otherId = doc[edgeDefinition.field] as any;
        return {
          id: otherId,
          doc: async () => {
            const otherDoc = await this.ctx.db.get(otherId);
            if (otherDoc === null) {
              throw new Error(
                `Dangling reference "${
                  doc[edgeDefinition.field] as string
                }" found in document with ID "${
                  doc._id as string
                }", expected to find a document with the first ID in table ${
                  edgeDefinition.to
                }.`
              );
            }
            return otherDoc;
          },
        };
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
): Ent<Table, DocumentByName<DataModel, Table>, DataModel, EntsDataModel> {
  const queryInterface = new PromiseEntWriterImpl(
    ctx as any,
    entDefinitions as any,
    table,
    async () => ({ id: doc._id as any, doc: async () => doc })
  );
  Object.defineProperty(doc, "edge", {
    value: (edge: any) => {
      return queryInterface.edge(edge);
    },
    enumerable: false,
    writable: false,
    configurable: false,
  });
  Object.defineProperty(doc, "edgeX", {
    value: (edge: any) => {
      return queryInterface.edgeX(edge);
    },
    enumerable: false,
    writable: false,
    configurable: false,
  });
  Object.defineProperty(doc, "patch", {
    value: (value: any) => {
      return queryInterface.patch(value);
    },
    enumerable: false,
    writable: false,
    configurable: false,
  });
  Object.defineProperty(doc, "replace", {
    value: (value: any) => {
      return queryInterface.replace(value);
    },
    enumerable: false,
    writable: false,
    configurable: false,
  });
  Object.defineProperty(doc, "delete", {
    value: () => {
      return queryInterface.delete();
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

export function entsReaderFactory<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>
>(
  ctx: GenericQueryCtx<DataModel>,
  entDefinitions: EntsDataModel
): EntsReaderFactory<DataModel, EntsDataModel> {
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

export function entsWriterFactory<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>
>(
  ctx: GenericMutationCtx<DataModel>,
  entDefinitions: EntsDataModel
): EntsWriterFactory<DataModel, EntsDataModel> {
  return (
    table: TableNamesInDataModel<DataModel>,
    indexName?: string,
    indexRange?: any
  ) => {
    if (typeof table !== "string") {
      throw new Error(`Expected table name, got \`${table as any}\``);
    }
    if (indexName !== undefined) {
      return new PromiseTableImpl(ctx, entDefinitions, table).withIndex(
        indexName,
        indexRange
      );
    }
    return new PromiseTableWriterImpl(ctx, entDefinitions, table) as any;
  };
}

type EntsReaderFactory<
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

type EntsWriterFactory<
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
  ): PromiseTable<DataModel, EntsDataModel, Table>;
  <Table extends TableNamesInDataModel<DataModel>>(
    table: Table
  ): PromiseTableWriter<Table, DataModel, EntsDataModel>;
};

declare class EntInstance<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> {
  edge<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge
  ): PromiseEdge<DataModel, EntsDataModel, Table, Edge>;
  edgeX<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge
  ): PromiseEdgeOrThrow<DataModel, EntsDataModel, Table, Edge>;
}

export type Ent<
  Table extends TableNamesInDataModel<DataModel>,
  Doc extends DocumentByName<DataModel, Table>,
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>
> = Doc & EntInstance<DataModel, EntsDataModel, Table>;

export type GenericEnt<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> = Ent<Table, DocumentByName<DataModel, Table>, DataModel, EntsDataModel>;

export type PromiseEdge<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>,
  Edge extends keyof EntsDataModel[Table]["edges"]
> = EntsDataModel[Table]["edges"][Edge]["cardinality"] extends "multiple"
  ? EntsDataModel[Table]["edges"][Edge]["type"] extends "ref"
    ? PromiseEdgeEnts<
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

export type PromiseEdgeOrThrow<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>,
  Edge extends keyof EntsDataModel[Table]["edges"]
> = EntsDataModel[Table]["edges"][Edge]["cardinality"] extends "multiple"
  ? EntsDataModel[Table]["edges"][Edge]["type"] extends "ref"
    ? PromiseEdgeEnts<
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
  ? PromiseEnt<
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
    ? PromiseEdgeEntsOrNull<
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

interface PromiseOrderedQueryWriter<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends Promise<
      EntWriter<
        Table,
        DocumentByName<DataModel, Table>,
        DataModel,
        EntsDataModel
      >[]
    >,
    PromiseOrderedQueryBase<DataModel, EntsDataModel, Table> {
  map<TOutput>(
    callbackFn: (
      value: EntWriter<
        Table,
        DocumentByName<DataModel, Table>,
        DataModel,
        EntsDataModel
      >,
      index: number,
      array: EntWriter<
        Table,
        DocumentByName<DataModel, Table>,
        DataModel,
        EntsDataModel
      >[]
    ) => Promise<TOutput> | TOutput
  ): Promise<TOutput[]>;

  take(n: number): PromiseEntsWriter<DataModel, EntsDataModel, Table>;

  firstX(): PromiseEntWriter<DataModel, EntsDataModel, Table>;

  uniqueX(): PromiseEntWriter<DataModel, EntsDataModel, Table>;
}

interface PromiseQueryWriter<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends PromiseOrderedQueryWriter<DataModel, EntsDataModel, Table> {
  order(
    order: "asc" | "desc",
    indexName?: IndexNames<NamedTableInfo<DataModel, Table>>
  ): PromiseOrderedQueryWriter<DataModel, EntsDataModel, Table>;
}

// This lazy promise materializes objects, so chaining to this type of
// lazy promise performs one operation for each
// retrieved document in JavaScript, basically as if using
// `Promise.all()`.
interface PromiseEntsWriter<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends PromiseEnts<DataModel, EntsDataModel, Table> {
  // This just returns the first retrieved document, or throws if there
  // are no documents. It does not optimize the previous steps in the query.
  firstX(): PromiseEntWriter<DataModel, EntsDataModel, Table>;

  // This just returns the unique retrieved document, or throws if there
  // are no documents. It does not optimize the previous steps in the query.
  // Otherwise it behaves like db.query().unique().
  uniqueX(): PromiseEntWriter<DataModel, EntsDataModel, Table>;
}

export interface PromiseTableWriter<
  Table extends TableNamesInDataModel<DataModel>,
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>
> extends PromiseQueryWriter<DataModel, EntsDataModel, Table>,
    PromiseTableBase<DataModel, EntsDataModel, Table> {
  /**
   * Fetch a document from the DB using given index, throw if it doesn't exist.
   */
  getX<
    Indexes extends DataModel[Table]["indexes"],
    Index extends keyof Indexes
  >(
    indexName: Index,
    // TODO: Figure out how to make this variadic
    value0: FieldTypeFromFieldPath<
      DocumentByName<DataModel, Table>,
      Indexes[Index][0]
    >
  ): PromiseEnt<DataModel, EntsDataModel, Table>;
  /**
   * Fetch a document from the DB for a given ID, throw if it doesn't exist.
   */
  getX(id: GenericId<Table>): PromiseEntWriter<DataModel, EntsDataModel, Table>;

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
  ): PromiseOrderedQueryWriter<DataModel, EntsDataModel, Table>;

  /**
   * Insert a new document into a table.
   *
   * @param table - The name of the table to insert a new document into.
   * @param value - The {@link Value} to insert into the given table.
   * @returns - {@link GenericId} of the new document.
   */
  // TODO: Chain methods to get the written document?
  insert(
    value: WithoutSystemFields<
      WithEdges<
        DataModel,
        DocumentByName<DataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >
  ): PromiseEntId<DataModel, EntsDataModel, Table>;

  /**
   * Insert new documents into a table.
   *
   * @param table - The name of the table to insert a new document into.
   * @param value - The {@link Value} to insert into the given table.
   * @returns - {@link GenericId} of the new document.
   */
  // TODO: Chain methods to get the written documents?
  insertMany(
    values: WithoutSystemFields<
      WithEdges<
        DataModel,
        DocumentByName<DataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >[]
  ): Promise<GenericId<Table>[]>;
}

class PromiseTableWriterImpl<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends PromiseTableImpl<DataModel, EntsDataModel, Table> {
  private base: WriterImplBase<DataModel, EntsDataModel, Table>;

  constructor(
    protected ctx: GenericMutationCtx<DataModel>,
    entDefinitions: EntsDataModel,
    table: Table
  ) {
    super(ctx, entDefinitions, table);
    this.base = new WriterImplBase(ctx, entDefinitions, table);
  }

  insert(
    value: WithoutSystemFields<
      WithEdges<
        DataModel,
        DocumentByName<DataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >
  ) {
    return new PromiseEntIdImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        await this.base.checkUniqueness(value);
        const fields = this.base.fieldsOnly(value as any);
        const docId = await this.ctx.db.insert(this.table, fields as any);
        const edges: EdgeChanges = {};
        Object.keys(value).forEach((key) => {
          const edgeDefinition: EdgeConfig = (
            this.entDefinitions[this.table]
              .edges as EntsDataModel[Table]["edges"]
          )[key] as any;
          if (
            edgeDefinition === undefined ||
            (edgeDefinition.cardinality === "single" &&
              edgeDefinition.type === "field")
          ) {
            return;
          }
          if (edgeDefinition.cardinality === "single") {
            throw new Error("Cannot set 1:1 edge from optional end.");
          }
          edges[key] = { add: value[key] };
        });
        await this.base.writeEdges(docId, edges);
        return docId;
      }
    );
  }

  // TODO: fluent API
  async insertMany(
    values: WithoutSystemFields<
      WithEdges<
        DataModel,
        DocumentByName<DataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >[]
  ) {
    return await Promise.all(values.map((value) => this.insert(value)));
  }
}

export interface PromiseEntWriter<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends Promise<
    EntWriter<Table, DocumentByName<DataModel, Table>, DataModel, EntsDataModel>
  > {
  edge<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge
  ): PromiseEdge<DataModel, EntsDataModel, Table, Edge>;

  edgeX<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge
  ): PromiseEdgeOrThrow<DataModel, EntsDataModel, Table, Edge>;

  /**
   * Patch this existing document, shallow merging it with the given partial
   * document.
   *
   * New fields are added. Existing fields are overwritten. Fields set to
   * `undefined` are removed.
   *
   * @param value - The partial {@link GenericDocument} to merge into this document. If this new value
   * specifies system fields like `_id`, they must match the document's existing field values.
   */
  patch(
    value: Partial<
      WithEdgePatches<
        DataModel,
        DocumentByName<DataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >
  ): Promise<PromiseEntId<DataModel, EntsDataModel, Table>>;

  /**
   * Replace the value of an existing document, overwriting its old value.
   *
   * @param value - The new {@link GenericDocument} for the document. This value can omit the system fields,
   * and the database will preserve them in.
   */
  replace(
    value: WithOptionalSystemFields<
      WithEdges<
        DataModel,
        DocumentByName<DataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >
  ): Promise<PromiseEntId<DataModel, EntsDataModel, Table>>;

  /**
   * Delete this existing document.
   *
   * @param id - The {@link GenericId} of the document to remove.
   */
  delete(): Promise<GenericId<Table>>;
}

class PromiseEntWriterImpl<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends PromiseEntOrNullImpl<DataModel, EntsDataModel, Table> {
  private base: WriterImplBase<DataModel, EntsDataModel, Table>;

  constructor(
    protected ctx: GenericMutationCtx<DataModel>,
    protected entDefinitions: EntsDataModel,
    protected table: Table,
    protected retrieve: DocRetriever<
      GenericId<Table>,
      DocumentByName<DataModel, Table>
    >
  ) {
    super(ctx, entDefinitions, table, retrieve);
    this.base = new WriterImplBase(ctx, entDefinitions, table);
  }

  patch(
    value: Partial<
      WithEdgePatches<
        DataModel,
        DocumentByName<DataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >
  ) {
    return new PromiseEntIdImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const { id } = await this.retrieve();
        await this.base.checkUniqueness(value, id);
        const fields = this.base.fieldsOnly(value);
        await this.ctx.db.patch(id, fields);

        const edges: EdgeChanges = {};
        await Promise.all(
          Object.keys(value).map(async (key) => {
            const edgeDefinition: EdgeConfig = (
              this.entDefinitions[this.table]
                .edges as EntsDataModel[Table]["edges"]
            )[key] as any;
            if (
              edgeDefinition === undefined ||
              (edgeDefinition.cardinality === "single" &&
                edgeDefinition.type === "field")
            ) {
              return;
            }
            if (edgeDefinition.cardinality === "single") {
              throw new Error("Cannot set 1:1 edge from optional end.");
              // const existing = await this.ctx.db
              //   .query(edgeDefinition.to)
              //   .withIndex(edgeDefinition.ref, (q) =>
              //     q.eq(edgeDefinition.ref, docId as any)
              //   )
              //   .unique();

              // edges[key] = {
              //   add: value[key] as GenericId<any>,
              //   remove: existing?._id as GenericId<any> | undefined,
              // };
            } else {
              edges[key] = value[key] as any;
            }
          })
        );
        await this.base.writeEdges(id, edges);
        return id;
      }
    );
  }

  replace(
    value: WithOptionalSystemFields<
      WithEdges<
        DataModel,
        DocumentByName<DataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >
  ) {
    return new PromiseEntIdImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const { id: docId } = await this.retrieve();
        await this.base.checkUniqueness(value, docId);
        const fields = this.base.fieldsOnly(value as any);
        await this.ctx.db.replace(docId, fields as any);

        const edges: EdgeChanges = {};

        await Promise.all(
          Object.values(
            this.entDefinitions[this.table].edges as Record<string, EdgeConfig>
          ).map(async (edgeDefinition) => {
            const key = edgeDefinition.name;
            const idOrIds = value[key];
            if (edgeDefinition.cardinality === "single") {
              if (edgeDefinition.type === "ref") {
                const oldDoc = (await this.ctx.db.get(docId))!;
                if (oldDoc[key] !== undefined && oldDoc[key] !== idOrIds) {
                  // This should be only allowed if the edge is optional
                  // on the field side.
                  // TODO: Write this info into the ref side of the edge in defineEntSchema.
                  // TODO: Even better encode this in types so that replace
                  // doesn't have this single edge in the signature.
                  throw new Error("Cannot set 1:1 edge from optional end.");
                  // edges[key] = {
                  //   add: idOrIds as GenericId<any>,
                  //   remove: oldDoc[key] as GenericId<any> | undefined,
                  // };
                }
              }
            } else {
              if (edgeDefinition.type === "field") {
                // TODO: Same issue around optionality as above
                const existing = (
                  await this.ctx.db
                    .query(edgeDefinition.to)
                    .withIndex(edgeDefinition.ref, (q) =>
                      q.eq(edgeDefinition.ref, docId as any)
                    )
                    .collect()
                ).map((doc) => doc._id);
                edges[key] = {
                  add: idOrIds as GenericId<any>[],
                  remove: existing as GenericId<any>[],
                };
              } else {
                const requested = new Set(idOrIds ?? []);
                const remove = (
                  await this.ctx.db
                    .query(edgeDefinition.table)
                    .withIndex(edgeDefinition.field, (q) =>
                      q.eq(edgeDefinition.field, docId as any)
                    )
                    .collect()
                )
                  .map((doc) => [doc._id, doc[edgeDefinition.ref]] as const)
                  .concat(
                    edgeDefinition.symmetric
                      ? (
                          await this.ctx.db
                            .query(edgeDefinition.table)
                            .withIndex(edgeDefinition.ref, (q) =>
                              q.eq(edgeDefinition.ref, docId as any)
                            )
                            .collect()
                        ).map(
                          (doc) => [doc._id, doc[edgeDefinition.field]] as const
                        )
                      : []
                  )
                  .filter(([_edgeId, otherId]) => {
                    if (requested.has(otherId as any)) {
                      requested.delete(otherId as any);
                      return false;
                    }
                    return true;
                  })
                  .map(([edgeId]) => edgeId);
                edges[key] = {
                  add: Array.from(requested) as GenericId<any>[],
                  removeEdges: remove as GenericId<any>[],
                };
              }
            }
          })
        );
        await this.base.writeEdges(docId, edges);
        return docId;
      }
    );
  }

  async delete() {
    const { id } = await this.retrieve();
    let memoized: GenericDocument | undefined = undefined;
    const oldDoc = async () => {
      if (memoized !== undefined) {
        return memoized;
      }
      return (memoized = (await this.ctx.db.get(id))!);
    };
    const edges: EdgeChanges = {};
    await Promise.all(
      Object.values(
        this.entDefinitions[this.table].edges as Record<string, EdgeConfig>
      ).map(async (edgeDefinition) => {
        const key = edgeDefinition.name;
        if (edgeDefinition.cardinality === "single") {
          if (edgeDefinition.type === "ref") {
            edges[key] = {
              remove: (await oldDoc())[key] as GenericId<any> | undefined,
            };
          }
        } else {
          if (edgeDefinition.type === "field") {
            const existing = (
              await this.ctx.db
                .query(edgeDefinition.to)
                .withIndex(edgeDefinition.ref, (q) =>
                  q.eq(edgeDefinition.ref, id as any)
                )
                .collect()
            ).map((doc) => doc._id);
            edges[key] = { remove: existing as GenericId<any>[] };
          } else {
            const existing = (
              await this.ctx.db
                .query(edgeDefinition.table)
                .withIndex(edgeDefinition.field, (q) =>
                  q.eq(edgeDefinition.field, id as any)
                )
                .collect()
            )
              .concat(
                edgeDefinition.symmetric
                  ? await this.ctx.db
                      .query(edgeDefinition.table)
                      .withIndex(edgeDefinition.ref, (q) =>
                        q.eq(edgeDefinition.ref, id as any)
                      )
                      .collect()
                  : []
              )
              .map((doc) => doc._id);
            edges[key] = { removeEdges: existing as GenericId<any>[] };
          }
        }
      })
    );
    await this.ctx.db.delete(id);
    await this.base.writeEdges(id, edges);
    return id;
  }
}

declare class EntWriterInstance<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends EntInstance<DataModel, EntsDataModel, Table> {
  /**
   * Patch this existing document, shallow merging it with the given partial
   * document.
   *
   * New fields are added. Existing fields are overwritten. Fields set to
   * `undefined` are removed.
   *
   * @param value - The partial {@link GenericDocument} to merge into this document. If this new value
   * specifies system fields like `_id`, they must match the document's existing field values.
   */
  patch(
    value: Partial<
      WithEdgePatches<
        DataModel,
        DocumentByName<DataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >
  ): PromiseEntId<DataModel, EntsDataModel, Table>;

  /**
   * Replace the value of this existing document, overwriting its old value.
   *
   * @param value - The new {@link GenericDocument} for the document. This value can omit the system fields,
   * and the database will preserve them in.
   */
  replace(
    value: WithOptionalSystemFields<
      WithEdges<
        DataModel,
        DocumentByName<DataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >
  ): PromiseEntId<DataModel, EntsDataModel, Table>;

  /**
   * Delete this existing document.
   *
   * @param id - The {@link GenericId} of the document to remove.
   */
  delete(): Promise<GenericId<Table>>;
}

// This type is strange: The ordering is strange,
// and the `Doc` would not have to be generic:
// This is all just so that the type shows useful
// informatin when hovering values.
type EntWriter<
  Table extends TableNamesInDataModel<DataModel>,
  Doc extends DocumentByName<DataModel, Table>,
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>
> = Doc & EntWriterInstance<DataModel, EntsDataModel, Table>;

export type GenericEntWriter<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> = EntWriter<
  Table,
  DocumentByName<DataModel, Table>,
  DataModel,
  EntsDataModel
>;

interface PromiseEntId<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends Promise<GenericId<Table>> {
  get(): PromiseEntWriter<DataModel, EntsDataModel, Table>;
}

class PromiseEntIdImpl<
    DataModel extends GenericDataModel,
    EntsDataModel extends GenericEntsDataModel<DataModel>,
    Table extends TableNamesInDataModel<DataModel>
  >
  extends Promise<GenericId<Table>>
  implements PromiseEntId<DataModel, EntsDataModel, Table>
{
  constructor(
    private ctx: GenericMutationCtx<DataModel>,
    private entDefinitions: EntsDataModel,
    private table: Table,
    private retrieve: () => Promise<GenericId<Table>>
  ) {
    super(() => {});
  }

  get() {
    return new PromiseEntOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const id = await this.retrieve();
        return { id, doc: async () => this.ctx.db.get(id) };
      }
    ) as any;
  }

  then<TResult1 = GenericId<Table>, TResult2 = never>(
    onfulfilled?:
      | ((value: GenericId<Table>) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): Promise<TResult1 | TResult2> {
    return this.retrieve().then(onfulfilled, onrejected);
  }
}

export type DocRetriever<ID, Doc> = () => Promise<{
  id: ID;
  doc: () => Promise<Doc>;
}>;

const nullRetriever = {
  id: null,
  doc: async () => null,
};

function idRetriever<
  DataModel extends GenericDataModel,
  Table extends TableNamesInDataModel<DataModel>
>(ctx: GenericQueryCtx<DataModel>, id: GenericId<Table>) {
  return {
    id,
    doc: async () => ctx.db.get(id),
  };
}

function loadedRetriever<
  DataModel extends GenericDataModel,
  Table extends TableNamesInDataModel<DataModel>
>(doc: DocumentByName<DataModel, Table> | null) {
  return {
    id: (doc?._id ?? null) as GenericId<Table> | null,
    doc: async () => doc,
  };
}
