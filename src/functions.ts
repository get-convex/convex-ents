import {
  DocumentByName,
  ExpressionOrValue,
  FieldTypeFromFieldPath,
  FilterBuilder,
  GenericDataModel,
  GenericDatabaseReader,
  GenericDatabaseWriter,
  GenericDocument,
  GenericTableInfo,
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
  Scheduler,
  SearchFilter,
  SearchFilterBuilder,
  SearchIndexNames,
  StorageWriter,
  TableNamesInDataModel,
  WithOptionalSystemFields,
  WithoutSystemFields,
} from "convex/server";
import { GenericId } from "convex/values";
import { ScheduledDeleteFuncRef } from "./deletion";
import {
  DeletionConfig,
  EdgeConfig,
  Expand,
  GenericEdgeConfig,
  GenericEntsDataModel,
  edgeCompoundIndexName,
} from "./schema";
import {
  EntsSystemDataModel,
  IndexFieldTypesForEq,
  PromiseEdgeResult,
  getEdgeDefinitions,
} from "./shared";
import {
  EdgeChanges,
  WithEdgeInserts,
  WithEdgePatches,
  WithEdges,
  WriterImplBase,
  isSystemTable,
} from "./writer";

export interface PromiseOrderedQueryOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<
    Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[] | null
  > {
  filter(
    predicate: (
      q: FilterBuilder<NamedTableInfo<EntsDataModel, Table>>,
    ) => ExpressionOrValue<boolean>,
  ): this;

  map<TOutput>(
    callbackFn: (
      value: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>,
      index: number,
      array: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[],
    ) => TOutput | Promise<TOutput>,
  ): PromiseArrayOrNull<TOutput>;

  paginate(
    paginationOpts: PaginationOptions,
  ): PromisePaginationResultOrNull<EntsDataModel, Table>;

  take(n: number): PromiseEntsOrNull<EntsDataModel, Table>;

  first(): PromiseEntOrNull<EntsDataModel, Table>;

  unique(): PromiseEntOrNull<EntsDataModel, Table>;

  docs(): Promise<DocumentByName<EntsDataModel, Table>[] | null>;
}

export interface PromiseOrderedQueryWriterOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<
    Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[] | null
  > {
  filter(
    predicate: (
      q: FilterBuilder<NamedTableInfo<EntsDataModel, Table>>,
    ) => ExpressionOrValue<boolean>,
  ): this;

  map<TOutput>(
    callbackFn: (
      value: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>,
      index: number,
      array: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[],
    ) => Promise<TOutput> | TOutput,
  ): PromiseArrayOrNull<TOutput>;

  paginate(
    paginationOpts: PaginationOptions,
  ): PromisePaginationResultOrNull<EntsDataModel, Table>;

  take(n: number): PromiseEntsWriterOrNull<EntsDataModel, Table>;

  first(): PromiseEntWriterOrNull<EntsDataModel, Table>;

  unique(): PromiseEntWriterOrNull<EntsDataModel, Table>;

  docs(): Promise<DocumentByName<EntsDataModel, Table>[] | null>;
}

export interface PromiseQueryOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends PromiseOrderedQueryOrNull<EntsDataModel, Table> {
  order(
    order: "asc" | "desc",
    indexName?: IndexNames<NamedTableInfo<EntsDataModel, Table>>,
  ): PromiseOrderedQueryOrNull<EntsDataModel, Table>;
}

export interface PromiseQueryWriterOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends PromiseOrderedQueryWriterOrNull<EntsDataModel, Table> {
  // TODO: The index variant should not be allowed if
  // this query already used an index
  order(
    order: "asc" | "desc",
    indexName?: IndexNames<NamedTableInfo<EntsDataModel, Table>>,
  ): PromiseOrderedQueryWriterOrNull<EntsDataModel, Table>;
}

export interface PromiseTableBase<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> {
  getMany<
    Indexes extends EntsDataModel[Table]["indexes"],
    Index extends keyof Indexes,
  >(
    indexName: Index,
    values: FieldTypeFromFieldPath<
      DocumentByName<EntsDataModel, Table>,
      Indexes[Index][0]
    >[],
  ): PromiseEntsOrNulls<EntsDataModel, Table>;
  getMany(ids: GenericId<Table>[]): PromiseEntsOrNulls<EntsDataModel, Table>;
  getManyX<
    Indexes extends EntsDataModel[Table]["indexes"],
    Index extends keyof Indexes,
  >(
    indexName: Index,
    values: FieldTypeFromFieldPath<
      DocumentByName<EntsDataModel, Table>,
      Indexes[Index][0]
    >[],
  ): PromiseEnts<EntsDataModel, Table>;
  getManyX(ids: GenericId<Table>[]): PromiseEnts<EntsDataModel, Table>;
  /**
   * If given a valid ID for the given table, returns it, or returns null if the ID
   * is from a different table or is not a valid ID.
   *
   * This does not guarantee that the ID exists (i.e. `table("foo").get(id)` may return `null`).
   */
  normalizeId(id: string): GenericId<Table> | null;
  /**
   * If given a valid ID for the given table, returns it, or throws if the ID
   * is from a different table or is not a valid ID.
   *
   * This does not guarantee that the ID exists (i.e. `table("foo").get(id)` may return `null`).
   */
  normalizeIdX(id: string): GenericId<Table>;
}

export interface PromiseTable<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends PromiseQuery<EntsDataModel, Table>,
    PromiseTableBase<EntsDataModel, Table> {
  get<
    Indexes extends EntsDataModel[Table]["indexes"],
    Index extends keyof Indexes,
  >(
    indexName: Index,
    ...values: IndexFieldTypesForEq<EntsDataModel, Table, Indexes[Index]>
  ): PromiseEntOrNull<EntsDataModel, Table>;
  get(id: GenericId<Table>): PromiseEntOrNull<EntsDataModel, Table>;
  /**
   * Fetch a unique document from the DB using given index, throw if it doesn't exist.
   */
  getX<
    Indexes extends EntsDataModel[Table]["indexes"],
    Index extends keyof Indexes,
  >(
    indexName: Index,
    ...values: IndexFieldTypesForEq<EntsDataModel, Table, Indexes[Index]>
  ): PromiseEnt<EntsDataModel, Table>;
  /**
   * Fetch a document from the DB for a given ID, throw if it doesn't exist.
   */
  getX(id: GenericId<Table>): PromiseEnt<EntsDataModel, Table>;

  /**
   * Return all documents in the table in given order.
   * Sort either by given index or by _creationTime.
   */
  order(
    order: "asc" | "desc",
    indexName?: IndexNames<NamedTableInfo<EntsDataModel, Table>>,
  ): PromiseOrderedQuery<EntsDataModel, Table>;

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
  search<
    IndexName extends SearchIndexNames<NamedTableInfo<EntsDataModel, Table>>,
  >(
    indexName: IndexName,
    searchFilter: (
      q: SearchFilterBuilder<
        DocumentByName<EntsDataModel, Table>,
        NamedSearchIndex<NamedTableInfo<EntsDataModel, Table>, IndexName>
      >,
    ) => SearchFilter,
  ): PromiseOrderedQuery<EntsDataModel, Table>;
}

export interface PromiseOrderedQueryBase<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> {
  filter(
    predicate: (
      q: FilterBuilder<NamedTableInfo<EntsDataModel, Table>>,
    ) => ExpressionOrValue<boolean>,
  ): this;

  docs(): Promise<DocumentByName<EntsDataModel, Table>[]>;
}

export interface PromiseOrderedQuery<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<
      Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]
    >,
    PromiseOrderedQueryBase<EntsDataModel, Table> {
  map<TOutput>(
    callbackFn: (
      value: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>,
      index: number,
      array: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[],
    ) => Promise<TOutput> | TOutput,
  ): PromiseArray<TOutput>;

  paginate(
    paginationOpts: PaginationOptions,
  ): PromisePaginationResult<EntsDataModel, Table>;

  take(n: number): PromiseEnts<EntsDataModel, Table>;

  first(): PromiseEntOrNull<EntsDataModel, Table>;

  firstX(): PromiseEnt<EntsDataModel, Table>;

  unique(): PromiseEntOrNull<EntsDataModel, Table>;

  uniqueX(): PromiseEnt<EntsDataModel, Table>;
}

export interface PromiseQuery<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends PromiseOrderedQuery<EntsDataModel, Table> {
  order(order: "asc" | "desc"): PromiseOrderedQuery<EntsDataModel, Table>;
}

class PromiseQueryOrNullImpl<
    EntsDataModel extends GenericEntsDataModel,
    Table extends TableNamesInDataModel<EntsDataModel>,
  >
  extends Promise<
    Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[] | null
  >
  implements PromiseQueryOrNull<EntsDataModel, Table>
{
  constructor(
    protected ctx: EntQueryCtx<EntsDataModel>,
    protected entDefinitions: EntsDataModel,
    protected table: Table,
    protected retrieve: () => Promise<Query<
      NamedTableInfo<EntsDataModel, Table>
    > | null>,
  ) {
    super(() => {});
  }

  filter(
    predicate: (
      q: FilterBuilder<NamedTableInfo<EntsDataModel, Table>>,
    ) => ExpressionOrValue<boolean>,
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
      },
    );
  }

  map<TOutput>(
    callbackFn: (
      value: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>,
      index: number,
      array: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[],
    ) => TOutput | Promise<TOutput>,
  ) {
    return new PromiseArrayImpl(async () => {
      const array = await this;
      if (array === null) {
        return null as TOutput[] | null;
      }
      return await Promise.all(array.map(callbackFn));
    });
  }

  order(
    order: "asc" | "desc",
    indexName?: IndexNames<NamedTableInfo<EntsDataModel, Table>>,
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
          return (
            query as QueryInitializer<NamedTableInfo<EntsDataModel, Table>>
          )
            .withIndex(indexName)
            .order(order);
        }
        return query.order(order) as any;
      },
    );
  }

  paginate(paginationOpts: PaginationOptions) {
    return new PromisePaginationResultOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const query = await this.retrieve();
        if (query === null) {
          return null;
        }
        return await query.paginate(paginationOpts);
      },
    );
  }

  take(n: number) {
    return new PromiseEntsOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        return await this._take(n);
      },
      false,
    );
  }

  first() {
    return new PromiseEntOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const docs = await this._take(1);
        if (docs === null) {
          return nullRetriever;
        }
        const [doc] = docs;
        return loadedRetriever(doc);
      },
      false,
    );
  }

  firstX() {
    return new PromiseEntWriterImpl(
      this.ctx as any,
      this.entDefinitions,
      this.table,
      async () => {
        const docs = await this._take(1);
        if (docs === null) {
          return nullRetriever;
        }
        const [doc] = docs;
        if (doc === undefined) {
          throw new Error("Query returned no documents");
        }
        return loadedRetriever(doc);
      },
      false,
    );
  }

  unique() {
    return new PromiseEntOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const docs = await this._take(2);
        if (docs === null) {
          return nullRetriever;
        }
        if (docs.length === 0) {
          return nullRetriever;
        }
        if (docs.length === 2) {
          throw new Error("unique() query returned more than one result");
        }
        const [doc] = docs;
        return loadedRetriever(doc);
      },
      false,
    );
  }

  uniqueX() {
    return new PromiseEntWriterImpl(
      this.ctx as any,
      this.entDefinitions,
      this.table,
      async () => {
        const docs = await this._take(2);
        if (docs === null) {
          return nullRetriever;
        }
        if (docs.length === 0) {
          throw new Error("Query returned no documents");
        }
        if (docs.length === 2) {
          throw new Error("unique() query returned more than one result");
        }
        const [doc] = docs;
        return loadedRetriever(doc);
      },
      true,
    );
  }

  async docs() {
    const query = await this.retrieve();
    if (query === null) {
      return null;
    }
    const docs = await query.collect();
    return filterByReadRule(
      this.ctx,
      this.entDefinitions,
      this.table,
      docs,
      false,
    );
  }

  then<
    TResult1 =
      | Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]
      | null,
    TResult2 = never,
  >(
    onfulfilled?:
      | ((
          value:
            | Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]
            | null,
        ) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null,
  ): Promise<TResult1 | TResult2> {
    return this.docs()
      .then((documents) =>
        documents === null
          ? null
          : documents.map((doc) =>
              entWrapper(doc, this.ctx, this.entDefinitions, this.table),
            ),
      )
      .then(onfulfilled, onrejected);
  }

  async _take(n: number) {
    const query = await this.retrieve();
    return await takeFromQuery(
      query,
      n,
      this.ctx,
      this.entDefinitions,
      this.table,
    );
  }
}

export interface PromisePaginationResultOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<PaginationResult<
    Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>
  > | null> {
  docs(): Promise<PaginationResult<
    DocumentByName<EntsDataModel, Table>
  > | null>;

  map<TOutput>(
    callbackFn: (
      value: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>,
      index: number,
      array: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[],
    ) => Promise<TOutput> | TOutput,
  ): Promise<PaginationResult<TOutput> | null>;
}

export interface PromisePaginationResult<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<
    PaginationResult<
      Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>
    >
  > {
  docs(): Promise<PaginationResult<DocumentByName<EntsDataModel, Table>>>;

  map<TOutput>(
    callbackFn: (
      value: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>,
      index: number,
      array: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[],
    ) => Promise<TOutput> | TOutput,
  ): Promise<PaginationResult<TOutput>>;
}

class PromisePaginationResultOrNullImpl<
    EntsDataModel extends GenericEntsDataModel,
    Table extends TableNamesInDataModel<EntsDataModel>,
  >
  extends Promise<PaginationResult<
    Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>
  > | null>
  implements PromisePaginationResultOrNull<EntsDataModel, Table>
{
  constructor(
    private ctx: EntQueryCtx<EntsDataModel>,
    private entDefinitions: EntsDataModel,
    private table: Table,
    protected retrieve: () => Promise<PaginationResult<
      DocumentByName<EntsDataModel, Table>
    > | null>,
  ) {
    super(() => {});
  }

  async map<TOutput>(
    callbackFn: (
      value: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>,
      index: number,
      array: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[],
    ) => Promise<TOutput> | TOutput,
  ) {
    const result = await this;
    if (result === null) {
      return null;
    }
    return {
      ...result,
      page: await Promise.all(result.page.map(callbackFn)),
    };
  }

  async docs() {
    const result = await this.retrieve();
    if (result === null) {
      return null;
    }
    return {
      ...result,
      page: (await filterByReadRule(
        this.ctx,
        this.entDefinitions,
        this.table,
        result.page,
        false,
      ))!,
    };
  }

  then<
    TResult1 =
      | Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]
      | null,
    TResult2 = never,
  >(
    onfulfilled?:
      | ((
          value: PaginationResult<
            Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>
          > | null,
        ) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null,
  ): Promise<TResult1 | TResult2> {
    return this.docs()
      .then((result) =>
        result === null
          ? null
          : {
              ...result,
              page: result.page.map((doc) =>
                entWrapper(doc, this.ctx, this.entDefinitions, this.table),
              ),
            },
      )
      .then(onfulfilled, onrejected);
  }
}

class PromiseTableImpl<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends PromiseQueryOrNullImpl<EntsDataModel, Table> {
  constructor(
    ctx: EntQueryCtx<EntsDataModel>,
    entDefinitions: EntsDataModel,
    table: Table,
  ) {
    super(ctx, entDefinitions, table, async () =>
      isSystemTable(table)
        ? (ctx.db.system.query(table as any) as any)
        : ctx.db.query(table),
    );
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
      this.entDefinitions,
      this.table,
      args.length === 1
        ? async () => {
            const id = args[0] as GenericId<Table>;
            if (this.normalizeId(id) === null) {
              throw new Error(`Invalid id \`${id}\` for table "${this.table}"`);
            }
            return {
              id,
              doc: async () => {
                const doc = await (isSystemTable(this.table)
                  ? this.ctx.db.system.get(id as any)
                  : this.ctx.db.get(id));
                if (throwIfNull && doc === null) {
                  throw new Error(
                    `Document not found with id \`${id}\` in table "${this.table}"`,
                  );
                }
                return doc;
              },
            } as any; // any because PromiseEntWriterImpl expects non-nullable
          }
        : async () => {
            const [indexName, ...values] = args;
            const fieldNames = getIndexFields(
              this.entDefinitions,
              this.table,
              indexName,
            );
            const doc = await this.ctx.db
              .query(this.table)
              .withIndex(indexName, (q) =>
                values.reduce((q, value, i) => q.eq(fieldNames[i], value), q),
              )
              .unique();
            if (throwIfNull && doc === null) {
              throw new Error(
                `Table "${this.table}" does not contain document with field${values.reduce(
                  (message, value, i) =>
                    `${message} "${fieldNames[i]}" = \`${value}\``,
                  "",
                )}`,
              );
            }
            return loadedRetriever(doc);
          },
      throwIfNull,
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
              if (this.normalizeId(id) === null) {
                throw new Error(
                  `Invalid id \`${id}\` for table "${this.table}"`,
                );
              }
            });
            return await Promise.all(
              ids.map(async (id) => {
                const doc = await (isSystemTable(this.table)
                  ? this.ctx.db.system.get(id as any)
                  : this.ctx.db.get(id));
                if (throwIfNull && doc === null) {
                  throw new Error(
                    `Document not found with id \`${id}\` in table "${this.table}"`,
                  );
                }
                return doc;
              }),
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
                    `Table "${this.table}" does not contain document with field "${indexName}" = \`${value}\``,
                  );
                }
                return doc;
              }),
            )) as any;
          },
      throwIfNull,
    );
  }

  normalizeId(id: string): GenericId<Table> | null {
    return isSystemTable(this.table)
      ? this.ctx.db.system.normalizeId(this.table as any, id)
      : this.ctx.db.normalizeId(this.table, id);
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
    indexName: IndexNames<NamedTableInfo<EntsDataModel, Table>>,
    indexRange?: (
      q: IndexRangeBuilder<
        DocumentByName<EntsDataModel, Table>,
        NamedIndex<NamedTableInfo<EntsDataModel, Table>, typeof indexName>
      >,
    ) => IndexRange,
  ) {
    return new PromiseQueryOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const query = await this.retrieve();
        return (
          query as QueryInitializer<NamedTableInfo<EntsDataModel, Table>>
        ).withIndex(indexName, indexRange);
      },
    );
  }

  search<
    IndexName extends SearchIndexNames<NamedTableInfo<EntsDataModel, Table>>,
  >(
    indexName: IndexName,
    searchFilter: (
      q: SearchFilterBuilder<
        DocumentByName<EntsDataModel, Table>,
        NamedSearchIndex<NamedTableInfo<EntsDataModel, Table>, IndexName>
      >,
    ) => SearchFilter,
  ) {
    return new PromiseQueryOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const query = await this.retrieve();
        return (
          query as QueryInitializer<NamedTableInfo<EntsDataModel, Table>>
        ).withSearchIndex(indexName, searchFilter) as any;
      },
    );
  }
}

// This lazy promise materializes objects, so chaining to this type of
// lazy promise performs one operation for each
// retrieved document in JavaScript, basically as if using `Promise.all()`.
export interface PromiseEntsOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<
    Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[] | null
  > {
  // TODO: At this point there is nothing query specific here, and we can either:
  //   1. Return a generic lazy promise of the list.
  //   2. Not give any methods, because they might lead devs down the wrong path.
  // // This just returns the first retrieved document, it does not optimize
  // // the previous steps in the query.
  // first(): PromiseEntOrNull<EntsDataModel, Table>;
  // // This just returns the unique retrieved document, it does not optimize
  // // the previous steps in the query. Otherwise it behaves like db.query().unique().
  // unique(): PromiseEntOrNull<EntsDataModel, Table>;

  map<TOutput>(
    callbackFn: (
      value: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>,
      index: number,
      array: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[],
    ) => Promise<TOutput> | TOutput,
  ): PromiseArrayOrNull<TOutput>;

  docs(): Promise<DocumentByName<EntsDataModel, Table>[] | null>;
}

export interface PromiseEntsWriterOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<
    | EntWriter<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]
    | null
  > {
  map<TOutput>(
    callbackFn: (
      value: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>,
      index: number,
      array: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[],
    ) => Promise<TOutput> | TOutput,
  ): PromiseArrayOrNull<TOutput>;

  docs(): Promise<DocumentByName<EntsDataModel, Table>[] | null>;
}

// This lazy promise materializes objects, so chaining to this type of
// lazy promise performs one operation for each
// retrieved document in JavaScript, basically as if using
// `Promise.all()`.
export interface PromiseEnts<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<
    Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]
  > {
  // TODO: At this point there is nothing query specific here, and we can either:
  //   1. Return a generic lazy promise of the list.
  //   2. Not give any methods, because they might lead devs down the wrong path.
  // // This just returns the first retrieved document, it does not optimize
  // // the previous steps in the query.
  // first(): PromiseEntOrNull<EntsDataModel, Table>;
  // // This just returns the first retrieved document, or throws if there
  // // are no documents. It does not optimize the previous steps in the query.
  // firstX(): PromiseEnt<EntsDataModel, Table>;
  // // This just returns the unique retrieved document, it does not optimize
  // // the previous steps in the query. Otherwise it behaves like db.query().unique().
  // unique(): PromiseEntOrNull<EntsDataModel, Table>;
  // // This just returns the unique retrieved document, or throws if there
  // // are no documents. It does not optimize the previous steps in the query.
  // // Otherwise it behaves like db.query().unique().
  // uniqueX(): PromiseEnt<EntsDataModel, Table>;

  map<TOutput>(
    callbackFn: (
      value: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>,
      index: number,
      array: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[],
    ) => Promise<TOutput> | TOutput,
  ): PromiseArray<TOutput>;

  docs(): Promise<DocumentByName<EntsDataModel, Table>[]>;
}

// Also implements `PromiseEntsOrNulls`, so individual docs can be null
class PromiseEntsOrNullImpl<
    EntsDataModel extends GenericEntsDataModel,
    Table extends TableNamesInDataModel<EntsDataModel>,
  >
  extends Promise<
    Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[] | null
  >
  implements PromiseEntsOrNull<EntsDataModel, Table>
{
  constructor(
    protected ctx: EntQueryCtx<EntsDataModel>,
    protected entDefinitions: EntsDataModel,
    protected table: Table,
    private retrieve: () => Promise<
      DocumentByName<EntsDataModel, Table>[] | null
    >,
    private throwIfNull: boolean,
  ) {
    super(() => {});
  }

  map<TOutput>(
    callbackFn: (
      value: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>,
      index: number,
      array: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[],
    ) => TOutput | Promise<TOutput>,
  ) {
    return new PromiseArrayImpl(async () => {
      const array = await this;
      if (array === null) {
        return null as TOutput[] | null;
      }
      return await Promise.all(array.map(callbackFn));
    });
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
      },
      false,
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
        const doc = docs[0] ?? undefined;
        if (doc === undefined) {
          throw new Error("Query returned no documents");
        }
        return loadedRetriever(doc);
      },
      true,
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
      },
      false,
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
      },
      true,
    );
  }

  async docs() {
    const docs = await this.retrieve();
    return filterByReadRule(
      this.ctx,
      this.entDefinitions,
      this.table,
      docs,
      this.throwIfNull,
    );
  }

  then<
    TResult1 =
      | Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]
      | null,
    TResult2 = never,
  >(
    onfulfilled?:
      | ((
          value:
            | Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]
            | null,
        ) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null,
  ): Promise<TResult1 | TResult2> {
    return this.docs()
      .then((docs) =>
        // Handles PromiseEntsOrNulls
        docs === null
          ? null
          : docs.map((doc) =>
              doc === null
                ? (null as any)
                : entWrapper(doc, this.ctx, this.entDefinitions, this.table),
            ),
      )
      .then(onfulfilled, onrejected);
  }
}

// This lazy promise materializes objects, so chaining to this type of
// lazy promise performs one operation for each
// retrieved document in JavaScript, basically as if using
// `Promise.all()`.
export interface PromiseEntsOrNulls<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<
    (Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel> | null)[]
  > {}

export interface PromiseEdgeOrderedEntsOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends PromiseEntsOrNull<EntsDataModel, Table> {
  /**
   * Paginate the ents on the other end of the edge.
   * Results are ordered by edge's `_creationTime`.
   */
  paginate(
    paginationOpts: PaginationOptions,
  ): PromisePaginationResultOrNull<EntsDataModel, Table>;

  /**
   * Take the first `n` ents on the other end of the edge
   * ordered by edge's `_creationTime`.
   */
  take(n: number): PromiseEntsOrNull<EntsDataModel, Table>;

  /**
   * Returns the first ent on the other end of the edge
   * ordered by edge's `_creationTime`, or `null`.
   */
  first(): PromiseEntOrNull<EntsDataModel, Table>;

  /**
   * Returns the only ent on the other end of the edge,
   * `null` if there are none, or throws if there are more than one.
   */
  unique(): PromiseEntOrNull<EntsDataModel, Table>;
}

export interface PromiseEdgeEntsOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends PromiseEdgeOrderedEntsOrNull<EntsDataModel, Table> {
  /**
   * Returns whether there is an ent with given ID on the other side
   * the edge. Returns null if chained to a null result.
   * @param id The ID of the ent on the other end of the edge
   */
  has(id: GenericId<Table>): Promise<boolean | null>;

  /**
   * Query the ents on the other end of the edge
   * ordered by edge's `_creationTime`.
   */
  order(
    order: "asc" | "desc",
    indexName?: IndexNames<NamedTableInfo<EntsDataModel, Table>>,
  ): PromiseEdgeOrderedEntsOrNull<EntsDataModel, Table>;
}

export interface PromiseEdgeOrderedEntsWriterOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends PromiseEntsWriterOrNull<EntsDataModel, Table> {
  /**
   * Paginate the ents on the other end of the edge.
   * Results are ordered by edge's `_creationTime`.
   */
  paginate(
    paginationOpts: PaginationOptions,
  ): PromisePaginationResultWriterOrNull<EntsDataModel, Table>;

  /**
   * Take the first `n` ents on the other end of the edge
   * ordered by edge's `_creationTime`.
   */
  take(n: number): PromiseEntsWriterOrNull<EntsDataModel, Table>;

  /**
   * Returns the first ent on the other end of the edge
   * ordered by edge's `_creationTime`, or `null`.
   */
  first(): PromiseEntWriterOrNull<EntsDataModel, Table>;

  /**
   * Returns the only ent on the other end of the edge,
   * `null` if there are none, or throws if there are more than one.
   */
  unique(): PromiseEntWriterOrNull<EntsDataModel, Table>;
}

export interface PromiseEdgeEntsWriterOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends PromiseEdgeOrderedEntsWriterOrNull<EntsDataModel, Table> {
  /**
   * Returns whether there is an ent with given ID on the other side
   * the edge. Returns null if chained to a null result.
   * @param id The ID of the ent on the other end of the edge
   */
  has(id: GenericId<Table>): Promise<boolean | null>;

  /**
   * Query the ents on the other end of the edge
   * ordered by edge's `_creationTime`.
   */
  order(
    order: "asc" | "desc",
    indexName?: IndexNames<NamedTableInfo<EntsDataModel, Table>>,
  ): PromiseEdgeOrderedEntsWriterOrNull<EntsDataModel, Table>;
}

export interface PromiseEdgeOrderedEnts<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends PromiseEnts<EntsDataModel, Table> {
  /**
   * Paginate the ents on the other end of the edge.
   * Results are ordered by edge's `_creationTime`.
   */
  paginate(
    paginationOpts: PaginationOptions,
  ): PromisePaginationResult<EntsDataModel, Table>;

  /**
   * Take the first `n` ents on the other end of the edge
   * ordered by edge's `_creationTime`.
   */
  take(n: number): PromiseEnts<EntsDataModel, Table>;

  /**
   * Returns the first ent on the other end of the edge
   * ordered by edge's `_creationTime`, or `null`.
   */
  first(): PromiseEntOrNull<EntsDataModel, Table>;

  /**
   * Returns the first ent on the other end of the edge
   * ordered by edge's `_creationTime`, or throws if there
   * are no ents on the other end of the edge.
   */
  firstX(): PromiseEnt<EntsDataModel, Table>;

  /**
   * Returns the only ent on the other end of the edge,
   * `null` if there are none, or throws if there are more than one.
   */
  unique(): PromiseEntOrNull<EntsDataModel, Table>;

  /**
   * Returns the only ent on the other end of the edge,
   * or throws if there are none or more than one.
   */
  uniqueX(): PromiseEnt<EntsDataModel, Table>;
}

export interface PromiseEdgeEnts<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends PromiseEdgeOrderedEnts<EntsDataModel, Table> {
  /**
   * Returns whether there is an ent with given ID on the other side
   * the edge.
   * @param id The ID of the ent on the other end of the edge
   */
  has(id: GenericId<Table>): Promise<boolean>;

  /**
   * Query the ents on the other end of the edge
   * ordered by edge's `_creationTime`.
   */
  order(
    order: "asc" | "desc",
    indexName?: IndexNames<NamedTableInfo<EntsDataModel, Table>>,
  ): PromiseEdgeOrderedEnts<EntsDataModel, Table>;
}

export interface PromiseEdgeOrderedEntsWriter<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends PromiseEntsWriter<EntsDataModel, Table> {
  /**
   * Paginate the ents on the other end of the edge.
   * Results are ordered by edge's `_creationTime`.
   */
  paginate(
    paginationOpts: PaginationOptions,
  ): PromisePaginationResultWriter<EntsDataModel, Table>;

  /**
   * Take the first `n` ents on the other end of the edge
   * ordered by edge's `_creationTime`.
   */
  take(n: number): PromiseEntsWriter<EntsDataModel, Table>;

  /**
   * Returns the first ent on the other end of the edge
   * ordered by edge's `_creationTime`, or `null`.
   */
  first(): PromiseEntWriterOrNull<EntsDataModel, Table>;

  /**
   * Returns the first ent on the other end of the edge
   * ordered by edge's `_creationTime`, or throws if there
   * are no ents on the other end of the edge.
   */
  firstX(): PromiseEntWriter<EntsDataModel, Table>;

  /**
   * Returns the only ent on the other end of the edge,
   * `null` if there are none, or throws if there are more than one.
   */
  unique(): PromiseEntWriterOrNull<EntsDataModel, Table>;

  /**
   * Returns the only ent on the other end of the edge,
   * or throws if there are none or more than one.
   */
  uniqueX(): PromiseEntWriter<EntsDataModel, Table>;
}

export interface PromiseEdgeEntsWriter<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends PromiseEdgeOrderedEntsWriter<EntsDataModel, Table> {
  /**
   * Returns whether there is an ent with given ID on the other side
   * the edge.
   * @param id The ID of the ent on the other end of the edge
   */
  has(id: GenericId<Table>): Promise<boolean>;

  /**
   * Query the ents on the other end of the edge
   * ordered by edge's `_creationTime`.
   */
  order(
    order: "asc" | "desc",
    indexName?: IndexNames<NamedTableInfo<EntsDataModel, Table>>,
  ): PromiseEdgeOrderedEntsWriter<EntsDataModel, Table>;
}

class PromiseEdgeOrNullImpl<
    EntsDataModel extends GenericEntsDataModel,
    Table extends TableNamesInDataModel<EntsDataModel>,
  >
  extends PromiseEntsOrNullImpl<EntsDataModel, Table>
  implements PromiseEdgeEntsOrNull<EntsDataModel, Table>
{
  constructor(
    ctx: EntQueryCtx<EntsDataModel>,
    entDefinitions: EntsDataModel,
    table: Table,
    private edgeDefinition: EdgeConfig & {
      cardinality: "multiple";
      type: "ref";
    },
    private retrieveSourceId: () => Promise<GenericId<string> | null>,
    private retrieveQuery: () => Promise<Query<GenericTableInfo> | null>,
    private retrieveDoc: (
      edgeDoc: GenericDocument,
    ) => Promise<DocumentByName<EntsDataModel, Table>> = async (edgeDoc) => {
      const sourceId = edgeDoc[edgeDefinition.field] as string;
      const targetId = edgeDoc[edgeDefinition.ref] as string;
      const doc = await this.ctx.db.get(targetId as any);
      if (doc === null) {
        throw new Error(
          `Dangling reference for edge "${edgeDefinition.name}" in ` +
            `table "${this.table}" for ` +
            `document with ID "${sourceId}": ` +
            `Could not find a document with ID "${targetId}"` +
            ` in table "${edgeDefinition.to}" (edge document ID is "${
              edgeDoc._id as string
            }").`,
        );
      }
      return doc;
    },
  ) {
    super(
      ctx,
      entDefinitions,
      table,
      async () => {
        const query = await retrieveQuery();
        if (query === null) {
          return null;
        }
        const edgeDocs = await query.collect();
        return await Promise.all(edgeDocs.map(retrieveDoc));
      },
      false,
    );
  }

  async has(targetId: GenericId<Table>) {
    const sourceId = await this.retrieveSourceId();
    if (sourceId === null) {
      return null;
    }
    const edgeDoc = await this.ctx.db
      .query(this.edgeDefinition.table)
      .withIndex(edgeCompoundIndexName(this.edgeDefinition), (q) =>
        (q.eq(this.edgeDefinition.field, sourceId as any) as any).eq(
          this.edgeDefinition.ref,
          targetId,
        ),
      )
      .first();
    return edgeDoc !== null;
  }

  order(order: "asc" | "desc") {
    return new PromiseEdgeOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      this.edgeDefinition,
      this.retrieveSourceId,
      async () => {
        const query = await this.retrieveQuery();
        if (query === null) {
          return null;
        }
        // This class supports both ordered and unordered queries,
        // so we pretend this one can be ordered again, interface types
        // won't allow it.
        return query.order(order) as Query<GenericTableInfo>;
      },
    );
  }

  paginate(paginationOpts: PaginationOptions) {
    return new PromisePaginationResultOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const query = await this.retrieveQuery();
        if (query === null) {
          return null;
        }
        const result = await query.paginate(paginationOpts);
        return {
          ...result,
          page: await Promise.all(result.page.map(this.retrieveDoc)),
        };
      },
    );
  }

  take(n: number) {
    return new PromiseEntsOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        return await this._take(n);
      },
      false,
    );
  }

  first() {
    return new PromiseEntOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const docs = await this._take(1);
        if (docs === null) {
          return nullRetriever;
        }
        const [doc] = docs;
        return loadedRetriever(doc);
      },
      false,
    );
  }

  firstX() {
    return new PromiseEntWriterImpl(
      this.ctx as any,
      this.entDefinitions,
      this.table,
      async () => {
        const docs = await this._take(1);
        if (docs === null) {
          return nullRetriever;
        }
        const [doc] = docs;
        if (doc === undefined) {
          throw new Error("Query returned no documents");
        }
        return loadedRetriever(doc);
      },
      false,
    );
  }

  unique() {
    return new PromiseEntOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const docs = await this._take(2);
        if (docs === null) {
          return nullRetriever;
        }
        if (docs.length === 0) {
          return nullRetriever;
        }
        if (docs.length === 2) {
          throw new Error("unique() query returned more than one result");
        }
        const [doc] = docs;
        return loadedRetriever(doc);
      },
      false,
    );
  }

  uniqueX() {
    return new PromiseEntWriterImpl(
      this.ctx as any,
      this.entDefinitions,
      this.table,
      async () => {
        const docs = await this._take(2);
        if (docs === null) {
          return nullRetriever;
        }
        if (docs.length === 0) {
          throw new Error("Query returned no documents");
        }
        if (docs.length === 2) {
          throw new Error("unique() query returned more than one result");
        }
        const [doc] = docs;
        return loadedRetriever(doc);
      },
      true,
    );
  }

  async _take(n: number) {
    const query = await this.retrieveQuery();
    return await takeFromQuery(
      query,
      n,
      this.ctx,
      this.entDefinitions,
      this.table,
      this.retrieveDoc,
    );
  }
}

export interface PromiseEntOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<Ent<
    Table,
    DocumentByName<EntsDataModel, Table>,
    EntsDataModel
  > | null> {
  edge<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge,
  ): PromiseEdgeOrNull<EntsDataModel, Table, Edge>;

  doc(): Promise<DocumentByName<EntsDataModel, Table> | null>;
}

export interface PromiseEnt<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<
    Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>
  > {
  edge<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge,
  ): PromiseEdge<EntsDataModel, Table, Edge>;

  edgeX<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge,
  ): PromiseEdgeOrThrow<EntsDataModel, Table, Edge>;

  doc(): Promise<DocumentByName<EntsDataModel, Table>>;
}

class PromiseEntOrNullImpl<
    EntsDataModel extends GenericEntsDataModel,
    Table extends TableNamesInDataModel<EntsDataModel>,
  >
  extends Promise<Ent<
    Table,
    DocumentByName<EntsDataModel, Table>,
    EntsDataModel
  > | null>
  implements PromiseEntOrNull<EntsDataModel, Table>
{
  constructor(
    protected ctx: EntQueryCtx<EntsDataModel>,
    protected entDefinitions: EntsDataModel,
    protected table: Table,
    protected retrieve: DocRetriever<
      GenericId<Table> | null,
      DocumentByName<EntsDataModel, Table> | null
    >,
    protected throwIfNull: boolean,
  ) {
    super(() => {});
  }

  async doc() {
    const { id, doc: getDoc } = await this.retrieve();
    if (id === null) {
      return null;
    }
    const doc = await getDoc();
    if (doc === null) {
      return null;
    }
    const readPolicy = getReadRule(this.entDefinitions, this.table);
    if (readPolicy !== undefined) {
      const decision = await readPolicy(
        entWrapper(doc, this.ctx, this.entDefinitions, this.table),
      );
      if (this.throwIfNull && !decision) {
        throw new Error(
          `Document cannot be read with id \`${doc._id as string}\` in table "${
            this.table
          }"`,
        );
      }
      return decision ? doc : null;
    }
    return doc;
  }

  then<
    TResult1 = Ent<
      Table,
      DocumentByName<EntsDataModel, Table>,
      EntsDataModel
    > | null,
    TResult2 = never,
  >(
    onfulfilled?:
      | ((
          value: Ent<
            Table,
            DocumentByName<EntsDataModel, Table>,
            EntsDataModel
          > | null,
        ) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null,
  ): Promise<TResult1 | TResult2> {
    return this.doc()
      .then((doc) =>
        doc === null
          ? null
          : entWrapper(doc, this.ctx, this.entDefinitions, this.table),
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
    throwIfNull = false,
  ) {
    const edgeDefinition = getEdgeDefinitions(this.entDefinitions, this.table)[
      edge
    ];

    if (edgeDefinition.cardinality === "multiple") {
      if (edgeDefinition.type === "ref") {
        return new PromiseEdgeOrNullImpl(
          this.ctx,
          this.entDefinitions,
          edgeDefinition.to,
          edgeDefinition,
          async () => {
            const { id } = await this.retrieve();
            return id;
          },
          async () => {
            const { id } = await this.retrieve();
            if (id === null) {
              return null;
            }
            return this.ctx.db
              .query(edgeDefinition.table)
              .withIndex(
                edgeDefinition.field,
                (q) => q.eq(edgeDefinition.field, id as any) as any,
              );
          },
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
              q.eq(edgeDefinition.ref, id as any),
            );
        },
      ) as any;
    }

    return new PromiseEntWriterImpl(
      this.ctx as any,
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
              q.eq(edgeDefinition.ref, id as any),
            )
            .unique();
          if (throwIfNull && otherDoc === null) {
            throw new Error(
              `Edge "${
                edgeDefinition.name
              }" does not exist for document with ID "${id as string}"`,
            );
          }
          return loadedRetriever(otherDoc);
        }
        const doc = (await getDoc())!;
        const otherId = doc[edgeDefinition.field] as any;
        return {
          id: otherId,
          doc: async () => {
            if (otherId === undefined) {
              if (edgeDefinition.optional) {
                return null;
              }
              throw new Error(
                `Unexpected null reference for edge "${edgeDefinition.name}" in ` +
                  `table "${this.table}" on document with ID "${id}": ` +
                  `Expected an ID for a document in table "${edgeDefinition.to}".`,
              );
            }
            const otherDoc = await this.ctx.db.get(otherId);
            // _scheduled_functions cannot be made dangling-reference-free,
            // because they are deleted by Convex automatically.
            if (
              otherDoc === null &&
              edgeDefinition.to !== "_scheduled_functions"
            ) {
              throw new Error(
                `Dangling reference for edge "${edgeDefinition.name}" in ` +
                  `table "${this.table}" on document with ID "${id}": ` +
                  `Could not find a document with ID "${otherId}"` +
                  ` in table "${edgeDefinition.to}".`,
              );
            }
            return otherDoc;
          },
        };
      },
      throwIfNull,
    ) as any;
  }
}

export interface PromiseArrayOrNull<T> extends Promise<T[] | null> {
  filter<S extends T>(
    predicate: (value: T, index: number, array: T[] | null) => value is S,
  ): Promise<S[] | null>;

  filter(
    predicate: (value: T, index: number, array: T[] | null) => unknown,
  ): Promise<T[] | null>;
}

export interface PromiseArray<T> extends Promise<T[]> {
  filter<S extends T>(
    predicate: (value: T, index: number, array: T[]) => value is S,
  ): Promise<S[]>;

  filter(
    predicate: (value: T, index: number, array: T[]) => unknown,
  ): Promise<T[]>;
}

class PromiseArrayImpl<T>
  extends Promise<T[] | null>
  implements PromiseArrayOrNull<T>
{
  constructor(protected retrieve: () => Promise<T[] | null>) {
    super(() => {});
  }

  async filter<S extends T>(
    predicate: (value: T, index: number, array: T[] | null) => value is S,
  ) {
    const array = await this.retrieve();
    if (array === null) {
      return null;
    }
    return array.filter(predicate);
  }

  then<TResult1 = T[] | null, TResult2 = never>(
    onfulfilled?:
      | ((value: T[] | null) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null,
  ): Promise<TResult1 | TResult2> {
    return this.retrieve().then(onfulfilled, onrejected);
  }
}

export function entWrapper<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
>(
  fields: DocumentByName<EntsDataModel, Table>,
  ctx: EntQueryCtx<EntsDataModel>,
  entDefinitions: EntsDataModel,
  table: Table,
): Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel> {
  const doc = { ...fields };
  const queryInterface = new PromiseEntWriterImpl(
    ctx as any,
    entDefinitions as any,
    table,
    async () => ({ id: doc._id as any, doc: async () => doc }),
    // this `true` doesn't matter, the queryInterface cannot be awaited
    true,
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
  Object.defineProperty(doc, "_edges", {
    value: () => {
      return getEdgeDefinitions(entDefinitions, table);
    },
    enumerable: false,
    writable: false,
    configurable: false,
  });
  Object.defineProperty(doc, "doc", {
    value: () => {
      return doc;
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
  Object.entries((entDefinitions as any)[table]?.defaults ?? []).map(
    ([field, value]) => {
      if (doc[field] === undefined) {
        (doc as any)[field] = value;
      }
    },
  );
  return doc as any;
}

export function entsTableFactory<
  Ctx extends EntQueryCtx<any>,
  EntsDataModel extends GenericEntsDataModel,
>(
  ctx: Ctx,
  entDefinitions: EntsDataModel,
  options?: {
    scheduledDelete?: ScheduledDeleteFuncRef;
  },
): Ctx extends EntMutationCtx<any>
  ? EntsTableWriter<EntsDataModel>
  : EntsTable<EntsDataModel> {
  const enrichedCtx = options !== undefined ? { ...ctx, ...options } : ctx;
  const table = (
    table: TableNamesInDataModel<EntsDataModel>,
    indexName?: string,
    indexRange?: any,
  ) => {
    // Consider being strict here if people struggle with setup:
    // if (typeof ctx.db?.query !== "function") {
    //   throw new Error(
    //     `Expected context with \`db\`, got \`${JSON.stringify(ctx)}\``
    //   );
    // }
    if (typeof table !== "string") {
      throw new Error(`Expected table name, got \`${table as any}\``);
    }

    if (indexName !== undefined) {
      return new PromiseTableImpl(
        enrichedCtx as any,
        entDefinitions,
        table,
      ).withIndex(indexName, indexRange);
    }
    if ((ctx.db as any).insert !== undefined) {
      return new PromiseTableWriterImpl(
        enrichedCtx as any,
        entDefinitions,
        table,
      );
    }
    return new PromiseTableImpl(enrichedCtx as any, entDefinitions, table);
  };
  table.system = table;
  return table as any;
}

type EntsTableReader<EntsDataModel extends GenericEntsDataModel> = {
  <
    Table extends TableNamesInDataModel<EntsDataModel>,
    IndexName extends IndexNames<NamedTableInfo<EntsDataModel, Table>>,
  >(
    table: Table,
    indexName: IndexName,
    indexRange?: (
      q: IndexRangeBuilder<
        DocumentByName<EntsDataModel, Table>,
        NamedIndex<NamedTableInfo<EntsDataModel, Table>, IndexName>
      >,
    ) => IndexRange,
  ): PromiseQuery<EntsDataModel, Table>;
  <Table extends TableNamesInDataModel<EntsDataModel>>(
    table: Table,
  ): PromiseTable<EntsDataModel, Table>;
};

export type EntsTable<EntsDataModel extends GenericEntsDataModel> =
  EntsTableReader<EntsDataModel> & {
    system: EntsTableReader<EntsSystemDataModel>;
  };

export type EntsTableWriter<EntsDataModel extends GenericEntsDataModel> = {
  <
    Table extends TableNamesInDataModel<EntsDataModel>,
    IndexName extends IndexNames<NamedTableInfo<EntsDataModel, Table>>,
  >(
    table: Table,
    indexName: IndexName,
    indexRange?: (
      q: IndexRangeBuilder<
        DocumentByName<EntsDataModel, Table>,
        NamedIndex<NamedTableInfo<EntsDataModel, Table>, IndexName>
      >,
    ) => IndexRange,
  ): PromiseQueryWriter<EntsDataModel, Table>;
  <Table extends TableNamesInDataModel<EntsDataModel>>(
    table: Table,
  ): PromiseTableWriter<Table, EntsDataModel>;

  system: EntsTableReader<EntsSystemDataModel>;
};

declare class EntInstance<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> {
  edge<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge,
  ): PromiseEdge<EntsDataModel, Table, Edge>;
  edgeX<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge,
  ): PromiseEdgeOrThrow<EntsDataModel, Table, Edge>;
  doc(): DocumentByName<EntsDataModel, Table>;
}

export type Ent<
  Table extends TableNamesInDataModel<EntsDataModel>,
  Doc extends DocumentByName<EntsDataModel, Table>,
  EntsDataModel extends GenericEntsDataModel,
> = Doc & EntInstance<EntsDataModel, Table>;

export type GenericEnt<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> = Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>;

export type PromiseEdge<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
  Edge extends keyof EntsDataModel[Table]["edges"],
  Config extends GenericEdgeConfig = EntsDataModel[Table]["edges"][Edge],
  ToTable extends
    TableNamesInDataModel<EntsDataModel> = EntsDataModel[Table]["edges"][Edge]["to"],
> = PromiseEdgeResult<
  Config,
  PromiseEdgeEnts<EntsDataModel, ToTable>,
  PromiseQuery<EntsDataModel, ToTable>,
  ToTable extends "_storage" | "_scheduled_functions"
    ? PromiseEntOrNull<EntsSystemDataModel, ToTable>
    : PromiseEntOrNull<EntsDataModel, ToTable>,
  ToTable extends "_storage"
    ? PromiseEnt<EntsSystemDataModel, ToTable>
    : ToTable extends "_scheduled_functions"
      ? PromiseEntOrNull<EntsSystemDataModel, ToTable>
      : PromiseEnt<EntsDataModel, ToTable>
>;

export type PromiseEdgeOrThrow<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
  Edge extends keyof EntsDataModel[Table]["edges"],
  Config extends GenericEdgeConfig = EntsDataModel[Table]["edges"][Edge],
  ToTable extends
    TableNamesInDataModel<EntsDataModel> = EntsDataModel[Table]["edges"][Edge]["to"],
> = PromiseEdgeResult<
  Config,
  PromiseEdgeEnts<EntsDataModel, ToTable>,
  PromiseQuery<EntsDataModel, ToTable>,
  PromiseEnt<EntsDataModel, ToTable>,
  PromiseEnt<EntsDataModel, ToTable>
>;

type PromiseEdgeOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
  Edge extends keyof EntsDataModel[Table]["edges"],
  Config extends GenericEdgeConfig = EntsDataModel[Table]["edges"][Edge],
  ToTable extends
    TableNamesInDataModel<EntsDataModel> = EntsDataModel[Table]["edges"][Edge]["to"],
> = PromiseEdgeResult<
  Config,
  PromiseEdgeEntsOrNull<EntsDataModel, ToTable>,
  PromiseQueryOrNull<EntsDataModel, ToTable>,
  PromiseEntOrNull<EntsDataModel, ToTable>,
  PromiseEntOrNull<EntsDataModel, ToTable>
>;

export type PromiseEdgeWriter<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
  Edge extends keyof EntsDataModel[Table]["edges"],
  Config extends GenericEdgeConfig = EntsDataModel[Table]["edges"][Edge],
  ToTable extends
    TableNamesInDataModel<EntsDataModel> = EntsDataModel[Table]["edges"][Edge]["to"],
> = PromiseEdgeResult<
  Config,
  PromiseEdgeEntsWriter<EntsDataModel, ToTable>,
  PromiseQueryWriter<EntsDataModel, ToTable>,
  PromiseEntWriterOrNull<EntsDataModel, ToTable>,
  PromiseEntWriter<EntsDataModel, ToTable>
>;

export type PromiseEdgeWriterOrThrow<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
  Edge extends keyof EntsDataModel[Table]["edges"],
  Config extends GenericEdgeConfig = EntsDataModel[Table]["edges"][Edge],
  ToTable extends
    TableNamesInDataModel<EntsDataModel> = EntsDataModel[Table]["edges"][Edge]["to"],
> = PromiseEdgeResult<
  Config,
  PromiseEdgeEntsWriter<EntsDataModel, ToTable>,
  PromiseQueryWriter<EntsDataModel, ToTable>,
  PromiseEntWriter<EntsDataModel, ToTable>,
  PromiseEntWriter<EntsDataModel, ToTable>
>;

export type PromiseEdgeWriterOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
  Edge extends keyof EntsDataModel[Table]["edges"],
  Config extends GenericEdgeConfig = EntsDataModel[Table]["edges"][Edge],
  ToTable extends
    TableNamesInDataModel<EntsDataModel> = EntsDataModel[Table]["edges"][Edge]["to"],
> = PromiseEdgeResult<
  Config,
  PromiseEdgeEntsWriterOrNull<EntsDataModel, ToTable>,
  PromiseQueryWriterOrNull<EntsDataModel, ToTable>,
  PromiseEntWriterOrNull<EntsDataModel, ToTable>,
  PromiseEntWriterOrNull<EntsDataModel, ToTable>
>;

export interface PromiseOrderedQueryWriter<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<
      EntWriter<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]
    >,
    PromiseOrderedQueryBase<EntsDataModel, Table> {
  paginate(
    paginationOpts: PaginationOptions,
  ): PromisePaginationResultWriter<EntsDataModel, Table>;

  map<TOutput>(
    callbackFn: (
      value: EntWriter<
        Table,
        DocumentByName<EntsDataModel, Table>,
        EntsDataModel
      >,
      index: number,
      array: EntWriter<
        Table,
        DocumentByName<EntsDataModel, Table>,
        EntsDataModel
      >[],
    ) => Promise<TOutput> | TOutput,
  ): PromiseArray<TOutput>;

  take(n: number): PromiseEntsWriter<EntsDataModel, Table>;

  first(): PromiseEntWriterOrNull<EntsDataModel, Table>;

  firstX(): PromiseEntWriter<EntsDataModel, Table>;

  unique(): PromiseEntWriterOrNull<EntsDataModel, Table>;

  uniqueX(): PromiseEntWriter<EntsDataModel, Table>;
}

export interface PromiseQueryWriter<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends PromiseOrderedQueryWriter<EntsDataModel, Table> {
  order(order: "asc" | "desc"): PromiseOrderedQueryWriter<EntsDataModel, Table>;
}

// This lazy promise materializes objects, so chaining to this type of
// lazy promise performs one operation for each
// retrieved document in JavaScript, basically as if using
// `Promise.all()`.
export interface PromiseEntsWriter<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends PromiseEnts<EntsDataModel, Table> {
  // This just returns the first retrieved document, or throws if there
  // are no documents. It does not optimize the previous steps in the query.
  firstX(): PromiseEntWriter<EntsDataModel, Table>;

  // This just returns the unique retrieved document, or throws if there
  // are no documents. It does not optimize the previous steps in the query.
  // Otherwise it behaves like db.query().unique().
  uniqueX(): PromiseEntWriter<EntsDataModel, Table>;
}

export interface PromisePaginationResultWriterOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<PaginationResult<
    EntWriter<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>
  > | null> {
  docs(): Promise<PaginationResult<
    DocumentByName<EntsDataModel, Table>
  > | null>;

  map<TOutput>(
    callbackFn: (
      value: EntWriter<
        Table,
        DocumentByName<EntsDataModel, Table>,
        EntsDataModel
      >,
      index: number,
      array: EntWriter<
        Table,
        DocumentByName<EntsDataModel, Table>,
        EntsDataModel
      >[],
    ) => Promise<TOutput> | TOutput,
  ): Promise<PaginationResult<TOutput> | null>;
}

export interface PromisePaginationResultWriter<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<
    PaginationResult<
      EntWriter<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>
    >
  > {
  docs(): Promise<PaginationResult<DocumentByName<EntsDataModel, Table>>>;

  map<TOutput>(
    callbackFn: (
      value: EntWriter<
        Table,
        DocumentByName<EntsDataModel, Table>,
        EntsDataModel
      >,
      index: number,
      array: EntWriter<
        Table,
        DocumentByName<EntsDataModel, Table>,
        EntsDataModel
      >[],
    ) => Promise<TOutput> | TOutput,
  ): Promise<PaginationResult<TOutput>>;
}

export interface PromiseTableWriter<
  Table extends TableNamesInDataModel<EntsDataModel>,
  EntsDataModel extends GenericEntsDataModel,
> extends PromiseQueryWriter<EntsDataModel, Table>,
    PromiseTableBase<EntsDataModel, Table> {
  get<
    Indexes extends EntsDataModel[Table]["indexes"],
    Index extends keyof Indexes,
  >(
    indexName: Index,
    ...values: IndexFieldTypesForEq<EntsDataModel, Table, Indexes[Index]>
  ): PromiseEntWriterOrNull<EntsDataModel, Table>;
  get(id: GenericId<Table>): PromiseEntWriterOrNull<EntsDataModel, Table>;
  /**
   * Fetch a unique document from the DB using given index, throw if it doesn't exist.
   */
  getX<
    Indexes extends EntsDataModel[Table]["indexes"],
    Index extends keyof Indexes,
  >(
    indexName: Index,
    ...values: IndexFieldTypesForEq<EntsDataModel, Table, Indexes[Index]>
  ): PromiseEntWriter<EntsDataModel, Table>;
  /**
   * Fetch a document from the DB for a given ID, throw if it doesn't exist.
   */
  getX(id: GenericId<Table>): PromiseEntWriter<EntsDataModel, Table>;

  /**
   * Return all documents in the table in given order.
   * Sort either by given index or by _creationTime.
   */
  order(
    order: "asc" | "desc",
    indexName?: IndexNames<NamedTableInfo<EntsDataModel, Table>>,
  ): PromiseOrderedQueryWriter<EntsDataModel, Table>;

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
  search<
    IndexName extends SearchIndexNames<NamedTableInfo<EntsDataModel, Table>>,
  >(
    indexName: IndexName,
    searchFilter: (
      q: SearchFilterBuilder<
        DocumentByName<EntsDataModel, Table>,
        NamedSearchIndex<NamedTableInfo<EntsDataModel, Table>, IndexName>
      >,
    ) => SearchFilter,
  ): PromiseOrderedQueryWriter<EntsDataModel, Table>;
  /**
   * Insert a new document into a table.
   *
   * @param table - The name of the table to insert a new document into.
   * @param value - The {@link Value} to insert into the given table.
   * @returns - {@link GenericId} of the new document.
   */
  insert(
    value: Expand<
      WithoutSystemFields<
        WithEdgeInserts<
          DocumentByName<EntsDataModel, Table>,
          EntsDataModel[Table]["edges"]
        >
      >
    >,
  ): PromiseEntId<EntsDataModel, Table>;
  /**
   * Insert new documents into a table.
   *
   * @param table - The name of the table to insert a new document into.
   * @param value - The {@link Value} to insert into the given table.
   * @returns - {@link GenericId} of the new document.
   */
  // TODO: Chain methods to get the written documents?
  insertMany(
    values: Expand<
      WithoutSystemFields<
        WithEdgeInserts<
          DocumentByName<EntsDataModel, Table>,
          EntsDataModel[Table]["edges"]
        >
      >
    >[],
  ): Promise<GenericId<Table>[]>;
}

class PromiseTableWriterImpl<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends PromiseTableImpl<EntsDataModel, Table> {
  private base: WriterImplBase<EntsDataModel, Table>;

  constructor(
    protected ctx: EntMutationCtx<EntsDataModel>,
    entDefinitions: EntsDataModel,
    table: Table,
  ) {
    super(ctx, entDefinitions, table);
    this.base = new WriterImplBase(ctx, entDefinitions, table);
  }

  insert(
    value: WithoutSystemFields<
      WithEdgeInserts<
        DocumentByName<EntsDataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >,
  ) {
    return new PromiseEntIdImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        await this.base.checkReadAndWriteRule("create", undefined, value);
        await this.base.checkUniqueness(value);
        const fields = this.base.fieldsOnly(value as any);
        const docId = await this.ctx.db.insert(this.table, fields as any);
        const edges: EdgeChanges = {};
        Object.keys(value).forEach((key) => {
          const edgeDefinition = getEdgeDefinitions(
            this.entDefinitions,
            this.table,
          )[key];
          if (
            edgeDefinition === undefined ||
            (edgeDefinition.cardinality === "single" &&
              edgeDefinition.type === "field")
          ) {
            return;
          }

          edges[key] = {
            add:
              edgeDefinition.cardinality === "single"
                ? [value[key] as GenericId<any>]
                : (value[key] as GenericId<any>[]),
          };
        });
        await this.base.writeEdges(docId, edges);
        return docId;
      },
    );
  }

  // TODO: fluent API
  async insertMany(
    values: WithoutSystemFields<
      WithEdgeInserts<
        DocumentByName<EntsDataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >[],
  ) {
    return await Promise.all(values.map((value) => this.insert(value)));
  }
}

export interface PromiseEntWriterOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<EntWriter<
    Table,
    DocumentByName<EntsDataModel, Table>,
    EntsDataModel
  > | null> {
  edge<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge,
  ): PromiseEdgeWriterOrNull<EntsDataModel, Table, Edge>;

  doc(): Promise<DocumentByName<EntsDataModel, Table> | null>;
}

export interface PromiseEntWriter<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<
    EntWriter<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>
  > {
  edge<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge,
  ): PromiseEdgeWriter<EntsDataModel, Table, Edge>;

  edgeX<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge,
  ): PromiseEdgeWriterOrThrow<EntsDataModel, Table, Edge>;

  doc(): Promise<DocumentByName<EntsDataModel, Table>>;

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
      Expand<
        WithEdgePatches<
          DocumentByName<EntsDataModel, Table>,
          EntsDataModel[Table]["edges"]
        >
      >
    >,
  ): PromiseEntId<EntsDataModel, Table>;

  /**
   * Replace the value of an existing document, overwriting its old value.
   *
   * @param value - The new {@link GenericDocument} for the document. This value can omit the system fields,
   * and the database will preserve them in.
   */
  replace(
    value: Expand<
      WithOptionalSystemFields<
        WithEdges<
          DocumentByName<EntsDataModel, Table>,
          EntsDataModel[Table]["edges"]
        >
      >
    >,
  ): PromiseEntId<EntsDataModel, Table>;

  /**
   * Delete this existing document.
   *
   * @param id - The {@link GenericId} of the document to remove.
   */
  delete(): Promise<GenericId<Table>>;
}

class PromiseEntWriterImpl<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends PromiseEntOrNullImpl<EntsDataModel, Table> {
  private base: WriterImplBase<EntsDataModel, Table>;

  constructor(
    protected ctx: EntMutationCtx<EntsDataModel>,
    protected entDefinitions: EntsDataModel,
    protected table: Table,
    protected retrieve: DocRetriever<
      GenericId<Table> | null,
      DocumentByName<EntsDataModel, Table> | null
    >,
    protected throwIfNull: boolean,
  ) {
    super(ctx, entDefinitions, table, retrieve, throwIfNull);
    this.base = new WriterImplBase(ctx, entDefinitions, table);
  }

  patch(
    value: Partial<
      WithEdgePatches<
        DocumentByName<EntsDataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >,
  ) {
    return new PromiseEntIdImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const { id: docId } = await this.retrieve();
        const id = docId!;
        await this.base.checkReadAndWriteRule("update", id, value);
        await this.base.checkUniqueness(value, id);
        const fields = this.base.fieldsOnly(value);
        await this.ctx.db.patch(id, fields);

        const edges: EdgeChanges = {};
        await Promise.all(
          Object.keys(value).map(async (key) => {
            const edgeDefinition = getEdgeDefinitions(
              this.entDefinitions,
              this.table,
            )[key];
            if (
              edgeDefinition === undefined ||
              (edgeDefinition.cardinality === "single" &&
                edgeDefinition.type === "field")
            ) {
              // The built-in patch takes care of updating the field
              return;
            }
            if (edgeDefinition.cardinality === "single") {
              throw new Error(
                `Cannot set 1:1 edge "${edgeDefinition.name}" on ent in table ` +
                  `"${this.table}", update the ent in "${edgeDefinition.to}"  ` +
                  `table instead.`,
              );
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
              if (edgeDefinition.type === "field") {
                throw new Error(
                  `Cannot set 1:many edges "${edgeDefinition.name}" on ent in table ` +
                    `"${this.table}", update the ents in "${edgeDefinition.to}"  ` +
                    `table instead.`,
                );
              } else {
                const { add, remove } = value[key]!;
                const removeEdges = (
                  await Promise.all(
                    (remove ?? []).map(async (otherId) =>
                      (
                        await this.ctx.db
                          .query(edgeDefinition.table)
                          .withIndex(
                            edgeCompoundIndexName(edgeDefinition),
                            (q) =>
                              (q.eq(edgeDefinition.field, id as any) as any).eq(
                                edgeDefinition.ref,
                                otherId,
                              ),
                          )
                          .collect()
                      ).concat(
                        edgeDefinition.symmetric
                          ? await this.ctx.db
                              .query(edgeDefinition.table)
                              .withIndex(
                                edgeCompoundIndexName(edgeDefinition),
                                (q) =>
                                  (
                                    q.eq(
                                      edgeDefinition.field,
                                      otherId as any,
                                    ) as any
                                  ).eq(edgeDefinition.ref, id),
                              )
                              .collect()
                          : [],
                      ),
                    ),
                  )
                )
                  .flat()
                  .map((edgeDoc) => edgeDoc._id as GenericId<any>);
                edges[key] = {
                  add,
                  removeEdges,
                };
              }
            }
          }),
        );
        await this.base.writeEdges(id, edges);
        return id;
      },
    );
  }

  replace(
    value: WithOptionalSystemFields<
      WithEdges<
        DocumentByName<EntsDataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >,
  ) {
    return new PromiseEntIdImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const { id } = await this.retrieve();
        const docId = id!;
        await this.base.checkReadAndWriteRule("update", docId, value);
        await this.base.checkUniqueness(value, docId);
        const fields = this.base.fieldsOnly(value as any);
        await this.ctx.db.replace(docId, fields as any);

        const edges: EdgeChanges = {};

        await Promise.all(
          Object.values(
            getEdgeDefinitions(this.entDefinitions, this.table),
          ).map(async (edgeDefinition) => {
            const key = edgeDefinition.name;
            const idOrIds = value[key];
            if (edgeDefinition.cardinality === "single") {
              if (edgeDefinition.type === "ref") {
                const oldDoc = (await this.ctx.db.get(docId))!;
                if (oldDoc[key] !== undefined && oldDoc[key] !== idOrIds) {
                  // This would be only allowed if the edge is optional
                  // on the field side, which is not supported

                  // TODO: Fix!

                  throw new Error("Cannot set 1:1 edge from ref end.");
                  // edges[key] = {
                  //   add: idOrIds as GenericId<any>,
                  //   remove: oldDoc[key] as GenericId<any> | undefined,
                  // };
                }
              }
            } else {
              if (edgeDefinition.type === "field") {
                if (idOrIds !== undefined) {
                  throw new Error("Cannot set 1:many edge from many end.");
                  // const existing = (
                  //   await this.ctx.db
                  //     .query(edgeDefinition.to)
                  //     .withIndex(edgeDefinition.ref, (q) =>
                  //       q.eq(edgeDefinition.ref, docId as any)
                  //     )
                  //     .collect()
                  // ).map((doc) => doc._id);
                  // edges[key] = {
                  //   add: idOrIds as GenericId<any>[],
                  //   remove: { remove: true },
                  // };
                }
              } else {
                const requested = new Set(idOrIds ?? []);
                const removeEdges = (
                  await this.ctx.db
                    .query(edgeDefinition.table)
                    .withIndex(edgeDefinition.field, (q) =>
                      q.eq(edgeDefinition.field, docId as any),
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
                              q.eq(edgeDefinition.ref, docId as any),
                            )
                            .collect()
                        ).map(
                          (doc) =>
                            [doc._id, doc[edgeDefinition.field]] as const,
                        )
                      : [],
                  )
                  .filter(([_edgeId, otherId]) => {
                    if (requested.has(otherId as any)) {
                      requested.delete(otherId as any);
                      return false;
                    }
                    return true;
                  })
                  .map(([edgeId]) => edgeId as GenericId<any>);
                edges[key] = {
                  add: (idOrIds ?? []) as GenericId<any>[],
                  removeEdges,
                };
              }
            }
          }),
        );
        await this.base.writeEdges(docId, edges);
        return docId;
      },
    );
  }

  async delete() {
    const { id: docId } = await this.retrieve();
    const id = docId!;
    return this.base.deleteId(id, "default");
  }
}

declare class EntWriterInstance<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends EntInstance<EntsDataModel, Table> {
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
        DocumentByName<EntsDataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >,
  ): PromiseEntId<EntsDataModel, Table>;

  /**
   * Replace the value of this existing document, overwriting its old value.
   *
   * @param value - The new {@link GenericDocument} for the document. This value can omit the system fields,
   * and the database will preserve them in.
   */
  replace(
    value: WithOptionalSystemFields<
      WithEdges<
        DocumentByName<EntsDataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >,
  ): PromiseEntId<EntsDataModel, Table>;

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
  Table extends TableNamesInDataModel<EntsDataModel>,
  Doc extends DocumentByName<EntsDataModel, Table>,
  EntsDataModel extends GenericEntsDataModel,
> = Doc & EntWriterInstance<EntsDataModel, Table>;

export type GenericEntWriter<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> = EntWriter<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>;

export interface PromiseEntId<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<GenericId<Table>> {
  get(): PromiseEntWriter<EntsDataModel, Table>;
}

class PromiseEntIdImpl<
    EntsDataModel extends GenericEntsDataModel,
    Table extends TableNamesInDataModel<EntsDataModel>,
  >
  extends Promise<GenericId<Table>>
  implements PromiseEntId<EntsDataModel, Table>
{
  constructor(
    private ctx: EntMutationCtx<EntsDataModel>,
    private entDefinitions: EntsDataModel,
    private table: Table,
    private retrieve: () => Promise<GenericId<Table>>,
  ) {
    super(() => {});
  }

  get() {
    return new PromiseEntWriterImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const id = await this.retrieve();
        return { id, doc: async () => this.ctx.db.get(id) };
      },
      true,
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
      | null,
  ): Promise<TResult1 | TResult2> {
    return this.retrieve().then(onfulfilled, onrejected);
  }
}

export interface EntQueryCtx<DataModel extends GenericDataModel> {
  db: GenericDatabaseReader<DataModel>;
  vectorSearch?: undefined;
}

export interface EntMutationCtx<DataModel extends GenericDataModel>
  extends EntQueryCtx<DataModel> {
  db: GenericDatabaseWriter<DataModel>;

  storage: StorageWriter;
  scheduler: Scheduler;
}

export type DocRetriever<ID, Doc> = () => Promise<{
  id: ID;
  doc: () => Promise<Doc>;
}>;

const nullRetriever = {
  id: null,
  doc: async () => null,
};

// function idRetriever<
//   DataModel extends GenericDataModel,
//   Table extends TableNamesInDataModel<DataModel>
// >(ctx: EntQueryCtx<DataModel>, id: GenericId<Table>) {
//   return {
//     id,
//     doc: async () => ctx.db.get(id),
//   };
// }

function loadedRetriever<
  DataModel extends GenericDataModel,
  Table extends TableNamesInDataModel<DataModel>,
>(doc: DocumentByName<DataModel, Table> | null) {
  return {
    id: (doc?._id ?? null) as GenericId<Table> | null,
    doc: async () => doc,
  };
}

type Rules = Record<string, RuleConfig>;

type RuleConfig = {
  read?: (doc: GenericDocument) => Promise<boolean>;
  write?: (
    args:
      | {
          operation: "create";
          ent: undefined;
          value: WithoutSystemFields<GenericDocument>;
        }
      | {
          operation: "update";
          ent: Ent<any, GenericDocument, any>;
          value: Partial<WithoutSystemFields<GenericDocument>>;
        }
      | {
          operation: "delete";
          ent: Ent<any, GenericDocument, any>;
          value: undefined;
        },
  ) => Promise<boolean>;
};

export function addEntRules<EntsDataModel extends GenericEntsDataModel>(
  entDefinitions: EntsDataModel,
  rules: {
    [Table in keyof EntsDataModel]?: Table extends TableNamesInDataModel<EntsDataModel>
      ? {
          read?: (
            ent: Ent<
              Table,
              DocumentByName<EntsDataModel, Table>,
              EntsDataModel
            >,
          ) => Promise<boolean>;
          write?: (
            args:
              | {
                  operation: "create";
                  ent: undefined;
                  value: WithoutSystemFields<
                    DocumentByName<EntsDataModel, Table>
                  >;
                }
              | {
                  operation: "update";
                  ent: Ent<
                    Table,
                    DocumentByName<EntsDataModel, Table>,
                    EntsDataModel
                  >;
                  value: Partial<
                    WithoutSystemFields<DocumentByName<EntsDataModel, Table>>
                  >;
                }
              | {
                  operation: "delete";
                  ent: Ent<
                    Table,
                    DocumentByName<EntsDataModel, Table>,
                    EntsDataModel
                  >;
                  value: undefined;
                },
          ) => Promise<boolean>;
        }
      : never;
  },
): EntsDataModel {
  return { ...entDefinitions, rules };
}

async function takeFromQuery(
  query: Query<GenericTableInfo> | null,
  n: number,
  ctx: EntQueryCtx<any>,
  entDefinitions: GenericEntsDataModel,
  table: string,
  mapToResult?: (retrieved: GenericDocument) => Promise<GenericDocument>,
) {
  if (query === null) {
    return null;
  }
  const readPolicy = getReadRule(entDefinitions, table);
  if (readPolicy === undefined) {
    const results = await query.take(n);
    if (mapToResult === undefined) {
      return results;
    }
    return Promise.all(results.map(mapToResult));
  }
  let numItems = n;
  const docs = [];
  let hasMore = true;
  const iterator = query[Symbol.asyncIterator]();
  while (hasMore && docs.length < n) {
    const page = [];
    for (let i = 0; i < numItems; i++) {
      const { done, value } = await iterator.next();
      if (done) {
        hasMore = false;
        break;
      }
      page.push(mapToResult === undefined ? value : await mapToResult(value));
    }
    docs.push(
      ...(await filterByReadRule(
        ctx,
        entDefinitions,
        table,
        page,
        false,
      ))!.slice(0, n - docs.length),
    );
    numItems = Math.min(64, numItems * 2);
  }
  return docs;
}

async function filterByReadRule<Doc extends GenericDocument>(
  ctx: EntQueryCtx<any>,
  entDefinitions: GenericEntsDataModel,
  table: string,
  docs: Doc[] | null,
  throwIfNull: boolean,
) {
  if (docs === null) {
    return null;
  }
  const readPolicy = getReadRule(entDefinitions, table);
  if (readPolicy === undefined) {
    return docs;
  }
  const decisions = await Promise.all(
    docs.map(async (doc) => {
      const decision = await readPolicy(
        entWrapper(doc, ctx, entDefinitions, table),
      );
      if (throwIfNull && !decision) {
        throw new Error(
          `Document cannot be read with id \`${
            doc._id as string
          }\` in table "${table}"`,
        );
      }
      return decision;
    }),
  );
  return docs.filter((_, i) => decisions[i]);
}

function getIndexFields(
  entDefinitions: GenericEntsDataModel,
  table: string,
  index: string,
) {
  return (entDefinitions[table].indexes as unknown as Record<string, string[]>)[
    index
  ];
}

export function getReadRule(
  entDefinitions: GenericEntsDataModel,
  table: string,
) {
  return (entDefinitions.rules as Rules)?.[table]?.read;
}

export function getWriteRule(
  entDefinitions: GenericEntsDataModel,
  table: string,
) {
  return (entDefinitions.rules as Rules)?.[table]?.write;
}

export function getDeletionConfig<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
>(entDefinitions: EntsDataModel, table: Table) {
  return (entDefinitions[table] as any).deletionConfig as
    | DeletionConfig
    | undefined;
}
