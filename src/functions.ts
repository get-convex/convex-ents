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
import { EdgeConfig, GenericEntsDataModel } from "./schema";
import {
  EdgeChanges,
  WithEdgePatches,
  WithEdges,
  WriterImplBase,
} from "./writer";

// TODO: Figure out how to make get() variadic
// type FieldTypes<
//
//   Table extends TableNamesInDataModel<EntsDataModel>,
//   T extends string[]
// > = {
//   [K in keyof T]: FieldTypeFromFieldPath<
//     DocumentByName<EntsDataModel, Table>,
//     T[K]
//   >;
// };

export interface PromiseOrderedQueryOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
> extends Promise<
    Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[] | null
  > {
  filter(
    predicate: (
      q: FilterBuilder<NamedTableInfo<EntsDataModel, Table>>
    ) => ExpressionOrValue<boolean>
  ): this;

  map<TOutput>(
    callbackFn: (
      value: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>,
      index: number,
      array: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]
    ) => Promise<TOutput> | TOutput
  ): Promise<TOutput[] | null>;

  // TODO: entWrapper for pagination
  paginate(
    paginationOpts: PaginationOptions
  ): Promise<PaginationResult<DocumentByName<EntsDataModel, Table>> | null>;

  take(n: number): PromiseEntsOrNull<EntsDataModel, Table>;

  first(): PromiseEntOrNull<EntsDataModel, Table>;

  unique(): PromiseEntOrNull<EntsDataModel, Table>;

  docs(): Promise<DocumentByName<EntsDataModel, Table>[] | null>;
}

export interface PromiseQueryOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
> extends PromiseOrderedQueryOrNull<EntsDataModel, Table> {
  // TODO: The index variant should not be allowed if
  // this query already used an index
  order(
    order: "asc" | "desc",
    indexName?: IndexNames<NamedTableInfo<EntsDataModel, Table>>
  ): PromiseOrderedQueryOrNull<EntsDataModel, Table>;
}

export interface PromiseTableBase<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
> {
  get<
    Indexes extends EntsDataModel[Table]["indexes"],
    Index extends keyof Indexes
  >(
    indexName: Index,
    // TODO: Figure out how to make this variadic
    value0: FieldTypeFromFieldPath<
      DocumentByName<EntsDataModel, Table>,
      Indexes[Index][0]
    >
  ): PromiseEntOrNull<EntsDataModel, Table>;
  get(id: GenericId<Table>): PromiseEntOrNull<EntsDataModel, Table>;

  getMany<
    Indexes extends EntsDataModel[Table]["indexes"],
    Index extends keyof Indexes
  >(
    indexName: Index,
    values: FieldTypeFromFieldPath<
      DocumentByName<EntsDataModel, Table>,
      Indexes[Index][0]
    >[]
  ): PromiseEntsOrNulls<EntsDataModel, Table>;
  getMany(ids: GenericId<Table>[]): PromiseEntsOrNulls<EntsDataModel, Table>;

  getManyX<
    Indexes extends EntsDataModel[Table]["indexes"],
    Index extends keyof Indexes
  >(
    indexName: Index,
    values: FieldTypeFromFieldPath<
      DocumentByName<EntsDataModel, Table>,
      Indexes[Index][0]
    >[]
  ): PromiseEnts<EntsDataModel, Table>;
  getManyX(ids: GenericId<Table>[]): PromiseEnts<EntsDataModel, Table>;

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

export interface PromiseTable<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
> extends PromiseQuery<EntsDataModel, Table>,
    PromiseTableBase<EntsDataModel, Table> {
  /**
   * Fetch a document from the DB using given index, throw if it doesn't exist.
   */
  getX<
    Indexes extends EntsDataModel[Table]["indexes"],
    Index extends keyof Indexes
  >(
    indexName: Index,
    // TODO: Figure out how to make this variadic
    value0: FieldTypeFromFieldPath<
      DocumentByName<EntsDataModel, Table>,
      Indexes[Index][0]
    >
  ): PromiseEnt<EntsDataModel, Table>;
  /**
   * Fetch a document from the DB for a given ID, throw if it doesn't exist.
   */
  getX(id: GenericId<Table>): PromiseEnt<EntsDataModel, Table>;

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
    IndexName extends SearchIndexNames<NamedTableInfo<EntsDataModel, Table>>
  >(
    indexName: IndexName,
    searchFilter: (
      q: SearchFilterBuilder<
        DocumentByName<EntsDataModel, Table>,
        NamedSearchIndex<NamedTableInfo<EntsDataModel, Table>, IndexName>
      >
    ) => SearchFilter
  ): PromiseOrderedQuery<EntsDataModel, Table>;
}

export interface PromiseOrderedQueryBase<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
> {
  filter(
    predicate: (
      q: FilterBuilder<NamedTableInfo<EntsDataModel, Table>>
    ) => ExpressionOrValue<boolean>
  ): this;

  // TODO: entWrapper for pagination
  paginate(
    paginationOpts: PaginationOptions
  ): Promise<PaginationResult<DocumentByName<EntsDataModel, Table>>>;

  first(): PromiseEntOrNull<EntsDataModel, Table>;

  unique(): PromiseEntOrNull<EntsDataModel, Table>;
}

export interface PromiseOrderedQuery<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
> extends Promise<
      Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]
    >,
    PromiseOrderedQueryBase<EntsDataModel, Table> {
  map<TOutput>(
    callbackFn: (
      value: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>,
      index: number,
      array: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]
    ) => Promise<TOutput> | TOutput
  ): Promise<TOutput[]>;

  take(n: number): PromiseEnts<EntsDataModel, Table>;

  firstX(): PromiseEnt<EntsDataModel, Table>;

  uniqueX(): PromiseEnt<EntsDataModel, Table>;

  docs(): Promise<DocumentByName<EntsDataModel, Table>[]>;
}

export interface PromiseQuery<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
> extends PromiseOrderedQuery<EntsDataModel, Table> {
  order(
    order: "asc" | "desc",
    indexName?: IndexNames<NamedTableInfo<EntsDataModel, Table>>
  ): PromiseOrderedQuery<EntsDataModel, Table>;
}

class PromiseQueryOrNullImpl<
    EntsDataModel extends GenericEntsDataModel,
    Table extends TableNamesInDataModel<EntsDataModel>
  >
  extends Promise<
    Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[] | null
  >
  implements PromiseQueryOrNull<EntsDataModel, Table>
{
  constructor(
    protected ctx: GenericQueryCtx<EntsDataModel>,
    protected entDefinitions: EntsDataModel,
    protected table: Table,
    protected retrieve: () => Promise<Query<
      NamedTableInfo<EntsDataModel, Table>
    > | null>
  ) {
    super(() => {});
  }

  filter(
    predicate: (
      q: FilterBuilder<NamedTableInfo<EntsDataModel, Table>>
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
      value: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>,
      index: number,
      array: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]
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
    indexName?: IndexNames<NamedTableInfo<EntsDataModel, Table>>
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
      }
    );
  }

  // TODO: RLS for pagination
  async paginate(
    paginationOpts: PaginationOptions
  ): Promise<PaginationResult<DocumentByName<EntsDataModel, Table>> | null> {
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
        return await this._take(n);
      },
      false
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
      false
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
      false
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
      false
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
      true
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
      false
    );
  }

  then<
    TResult1 =
      | Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]
      | null,
    TResult2 = never
  >(
    onfulfilled?:
      | ((
          value:
            | Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]
            | null
        ) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): Promise<TResult1 | TResult2> {
    return this.docs()
      .then((documents) =>
        documents === null
          ? null
          : documents.map((doc) =>
              entWrapper(doc, this.ctx, this.entDefinitions, this.table)
            )
      )
      .then(onfulfilled, onrejected);
  }

  async _take(n: number) {
    const query = await this.retrieve();
    if (query === null) {
      return null;
    }
    const readPolicy = getReadRule(this.entDefinitions, this.table);
    if (readPolicy === undefined) {
      return await query.take(n);
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
        page.push(value);
      }
      docs.push(
        ...(await filterByReadRule(
          this.ctx,
          this.entDefinitions,
          this.table,
          page,
          false
        ))!.slice(0, n - docs.length)
      );
      numItems = Math.min(64, numItems * 2);
    }
    return docs;
  }
}

class PromiseTableImpl<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
> extends PromiseQueryOrNullImpl<EntsDataModel, Table> {
  constructor(
    ctx: GenericQueryCtx<EntsDataModel>,
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
      this.entDefinitions,
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
            return loadedRetriever(doc);
          },
      throwIfNull
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
          },
      throwIfNull
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
    indexName: IndexNames<NamedTableInfo<EntsDataModel, Table>>,
    indexRange?: (
      q: IndexRangeBuilder<
        DocumentByName<EntsDataModel, Table>,
        NamedIndex<NamedTableInfo<EntsDataModel, Table>, typeof indexName>
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
          query as QueryInitializer<NamedTableInfo<EntsDataModel, Table>>
        ).withIndex(indexName, indexRange);
      }
    );
  }

  search<
    IndexName extends SearchIndexNames<NamedTableInfo<EntsDataModel, Table>>
  >(
    indexName: IndexName,
    searchFilter: (
      q: SearchFilterBuilder<
        DocumentByName<EntsDataModel, Table>,
        NamedSearchIndex<NamedTableInfo<EntsDataModel, Table>, IndexName>
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
          query as QueryInitializer<NamedTableInfo<EntsDataModel, Table>>
        ).withSearchIndex(indexName, searchFilter) as any;
      }
    );
  }
}

// This lazy promise materializes objects, so chaining to this type of
// lazy promise performs one operation for each
// retrieved document in JavaScript, basically as if using `Promise.all()`.
export interface PromiseEntsOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
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

  docs(): Promise<DocumentByName<EntsDataModel, Table>[] | null>;
}

// This lazy promise materializes objects, so chaining to this type of
// lazy promise performs one operation for each
// retrieved document in JavaScript, basically as if using
// `Promise.all()`.
export interface PromiseEnts<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
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

  docs(): Promise<DocumentByName<EntsDataModel, Table>[]>;
}

class PromiseEntsOrNullImpl<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
> extends Promise<
  Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[] | null
> {
  constructor(
    private ctx: GenericQueryCtx<EntsDataModel>,
    private entDefinitions: EntsDataModel,
    private table: Table,
    private retrieve: () => Promise<
      DocumentByName<EntsDataModel, Table>[] | null
    >,
    private throwIfNull: boolean
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
      },
      false
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
      true
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
      false
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
      true
    );
  }

  async docs() {
    const docs = await this.retrieve();
    return filterByReadRule(
      this.ctx,
      this.entDefinitions,
      this.table,
      docs,
      this.throwIfNull
    );
  }

  then<
    TResult1 =
      | Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]
      | null,
    TResult2 = never
  >(
    onfulfilled?:
      | ((
          value:
            | Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]
            | null
        ) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): Promise<TResult1 | TResult2> {
    return this.docs()
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
export interface PromiseEntsOrNulls<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
> extends Promise<
    (Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel> | null)[]
  > {}

interface PromiseEdgeEntsOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
> extends PromiseEntsOrNull<EntsDataModel, Table> {
  /**
   * Returns whether there is an ent with given ID on the other side
   * the edge. Returns null if chained to a null result.
   * @param id The ID of the ent on the other end of the edge
   */
  has(id: GenericId<Table>): Promise<boolean | null>;
}

interface PromiseEdgeEnts<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
> extends PromiseEnts<EntsDataModel, Table> {
  /**
   * Returns whether there is an ent with given ID on the other side
   * the edge.
   * @param id The ID of the ent on the other end of the edge
   */
  has(id: GenericId<Table>): Promise<boolean>;
}

class PromiseEdgeOrNullImpl<
    EntsDataModel extends GenericEntsDataModel,
    Table extends TableNamesInDataModel<EntsDataModel>
  >
  extends PromiseEntsOrNullImpl<EntsDataModel, Table>
  implements PromiseEdgeEntsOrNull<EntsDataModel, Table>
{
  constructor(
    ctx: GenericQueryCtx<EntsDataModel>,
    entDefinitions: EntsDataModel,
    table: Table,
    private field: string,
    private retrieveRange: (
      indexRange: (
        q: IndexRangeBuilder<DocumentByName<EntsDataModel, Table>, any>
      ) => any
    ) => Promise<DocumentByName<EntsDataModel, Table>[] | null>
  ) {
    super(ctx, entDefinitions, table, () => retrieveRange((q) => q), false);
  }

  async has(id: GenericId<Table>) {
    const docs = await this.retrieveRange((q) => q.eq(this.field, id as any));
    return (docs?.length ?? 0) > 0;
  }
}

export interface PromiseEntOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
> extends Promise<Ent<
    Table,
    DocumentByName<EntsDataModel, Table>,
    EntsDataModel
  > | null> {
  edge<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge
  ): PromiseEdgeOrNull<EntsDataModel, Table, Edge>;

  doc(): Promise<DocumentByName<EntsDataModel, Table> | null>;
}

export interface PromiseEnt<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
> extends Promise<
    Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>
  > {
  edge<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge
  ): PromiseEdge<EntsDataModel, Table, Edge>;

  edgeX<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge
  ): PromiseEdgeOrThrow<EntsDataModel, Table, Edge>;

  doc(): Promise<DocumentByName<EntsDataModel, Table>>;
}

class PromiseEntOrNullImpl<
    EntsDataModel extends GenericEntsDataModel,
    Table extends TableNamesInDataModel<EntsDataModel>
  >
  extends Promise<Ent<
    Table,
    DocumentByName<EntsDataModel, Table>,
    EntsDataModel
  > | null>
  implements PromiseEntOrNull<EntsDataModel, Table>
{
  constructor(
    protected ctx: GenericQueryCtx<EntsDataModel>,
    protected entDefinitions: EntsDataModel,
    protected table: Table,
    protected retrieve: DocRetriever<
      GenericId<Table> | null,
      DocumentByName<EntsDataModel, Table> | null
    >,
    protected throwIfNull: boolean
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
        entWrapper(doc, this.ctx, this.entDefinitions, this.table)
      );
      if (this.throwIfNull && !decision) {
        throw new Error(
          `Document cannot be read with id \`${doc._id as string}\` in table "${
            this.table
          }"`
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
    TResult2 = never
  >(
    onfulfilled?:
      | ((
          value: Ent<
            Table,
            DocumentByName<EntsDataModel, Table>,
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
    return this.doc()
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
                  `Dangling reference for edge "${edgeDefinition.name}" in ` +
                    `table "${this.table}" for document with ID "${id}": ` +
                    `Could not find a document with ID "${
                      edgeDocs[i][edgeDefinition.field] as string
                    }"` +
                    ` in table "${edgeDefinition.to}" (edge document ID is "${
                      edgeDocs[i]._id as string
                    }").`
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
              }" does not exist for document with ID "${id as string}"`
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
                `Dangling reference for edge "${edgeDefinition.name}" in ` +
                  `table "${this.table}" for document with ID "${id}": ` +
                  `Could not find a document with ID "${otherId}"` +
                  ` in table "${edgeDefinition.to}".`
              );
            }
            return otherDoc;
          },
        };
      },
      throwIfNull
    ) as any;
  }
}

function entWrapper<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
>(
  fields: DocumentByName<EntsDataModel, Table>,
  ctx: GenericQueryCtx<EntsDataModel>,
  entDefinitions: EntsDataModel,
  table: Table
): Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel> {
  const doc = { ...fields };
  const queryInterface = new PromiseEntWriterImpl(
    ctx as any,
    entDefinitions as any,
    table,
    async () => ({ id: doc._id as any, doc: async () => doc }),
    // this `true` doesn't matter, the queryInterface cannot be awaited
    true
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

export function entsTableFactory<EntsDataModel extends GenericEntsDataModel>(
  ctx: GenericQueryCtx<any>,
  entDefinitions: EntsDataModel
): EntsTable<EntsDataModel> {
  return (
    table: TableNamesInDataModel<EntsDataModel>,
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

export function entsTableWriterFactory<
  EntsDataModel extends GenericEntsDataModel
>(
  ctx: GenericMutationCtx<any>,
  entDefinitions: EntsDataModel
): EntsTableWriter<EntsDataModel> {
  return (
    table: TableNamesInDataModel<EntsDataModel>,
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

type EntsTable<EntsDataModel extends GenericEntsDataModel> = {
  <
    Table extends TableNamesInDataModel<EntsDataModel>,
    IndexName extends IndexNames<NamedTableInfo<EntsDataModel, Table>>
  >(
    table: Table,
    indexName: IndexName,
    indexRange?: (
      q: IndexRangeBuilder<
        DocumentByName<EntsDataModel, Table>,
        NamedIndex<NamedTableInfo<EntsDataModel, Table>, IndexName>
      >
    ) => IndexRange
  ): PromiseQuery<EntsDataModel, Table>;
  <Table extends TableNamesInDataModel<EntsDataModel>>(
    table: Table
  ): PromiseTable<EntsDataModel, Table>;
};

type EntsTableWriter<EntsDataModel extends GenericEntsDataModel> = {
  <
    Table extends TableNamesInDataModel<EntsDataModel>,
    IndexName extends IndexNames<NamedTableInfo<EntsDataModel, Table>>
  >(
    table: Table,
    indexName: IndexName,
    indexRange?: (
      q: IndexRangeBuilder<
        DocumentByName<EntsDataModel, Table>,
        NamedIndex<NamedTableInfo<EntsDataModel, Table>, IndexName>
      >
    ) => IndexRange
  ): PromiseTable<EntsDataModel, Table>;
  <Table extends TableNamesInDataModel<EntsDataModel>>(
    table: Table
  ): PromiseTableWriter<Table, EntsDataModel>;
};

declare class EntInstance<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
> {
  edge<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge
  ): PromiseEdge<EntsDataModel, Table, Edge>;
  edgeX<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge
  ): PromiseEdgeOrThrow<EntsDataModel, Table, Edge>;
}

export type Ent<
  Table extends TableNamesInDataModel<EntsDataModel>,
  Doc extends DocumentByName<EntsDataModel, Table>,
  EntsDataModel extends GenericEntsDataModel
> = Doc & EntInstance<EntsDataModel, Table>;

export type GenericEnt<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
> = Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>;

export type PromiseEdge<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
  Edge extends keyof EntsDataModel[Table]["edges"]
> = EntsDataModel[Table]["edges"][Edge]["cardinality"] extends "multiple"
  ? EntsDataModel[Table]["edges"][Edge]["type"] extends "ref"
    ? PromiseEdgeEnts<EntsDataModel, EntsDataModel[Table]["edges"][Edge]["to"]>
    : PromiseQuery<EntsDataModel, EntsDataModel[Table]["edges"][Edge]["to"]>
  : EntsDataModel[Table]["edges"][Edge]["type"] extends "ref"
  ? PromiseEntOrNull<EntsDataModel, EntsDataModel[Table]["edges"][Edge]["to"]>
  : PromiseEnt<EntsDataModel, EntsDataModel[Table]["edges"][Edge]["to"]>;

export type PromiseEdgeOrThrow<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
  Edge extends keyof EntsDataModel[Table]["edges"]
> = EntsDataModel[Table]["edges"][Edge]["cardinality"] extends "multiple"
  ? EntsDataModel[Table]["edges"][Edge]["type"] extends "ref"
    ? PromiseEdgeEnts<EntsDataModel, EntsDataModel[Table]["edges"][Edge]["to"]>
    : PromiseQuery<EntsDataModel, EntsDataModel[Table]["edges"][Edge]["to"]>
  : EntsDataModel[Table]["edges"][Edge]["type"] extends "ref"
  ? PromiseEnt<EntsDataModel, EntsDataModel[Table]["edges"][Edge]["to"]>
  : PromiseEnt<EntsDataModel, EntsDataModel[Table]["edges"][Edge]["to"]>;

type PromiseEdgeOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
  Edge extends keyof EntsDataModel[Table]["edges"]
> = EntsDataModel[Table]["edges"][Edge]["cardinality"] extends "multiple"
  ? EntsDataModel[Table]["edges"][Edge]["type"] extends "ref"
    ? PromiseEdgeEntsOrNull<
        EntsDataModel,
        EntsDataModel[Table]["edges"][Edge]["to"]
      >
    : PromiseQueryOrNull<
        EntsDataModel,
        EntsDataModel[Table]["edges"][Edge]["to"]
      >
  : PromiseEntOrNull<EntsDataModel, EntsDataModel[Table]["edges"][Edge]["to"]>;

interface PromiseOrderedQueryWriter<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
> extends Promise<
      EntWriter<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]
    >,
    PromiseOrderedQueryBase<EntsDataModel, Table> {
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
      >[]
    ) => Promise<TOutput> | TOutput
  ): Promise<TOutput[]>;

  take(n: number): PromiseEntsWriter<EntsDataModel, Table>;

  firstX(): PromiseEntWriter<EntsDataModel, Table>;

  uniqueX(): PromiseEntWriter<EntsDataModel, Table>;
}

interface PromiseQueryWriter<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
> extends PromiseOrderedQueryWriter<EntsDataModel, Table> {
  order(
    order: "asc" | "desc",
    indexName?: IndexNames<NamedTableInfo<EntsDataModel, Table>>
  ): PromiseOrderedQueryWriter<EntsDataModel, Table>;
}

// This lazy promise materializes objects, so chaining to this type of
// lazy promise performs one operation for each
// retrieved document in JavaScript, basically as if using
// `Promise.all()`.
interface PromiseEntsWriter<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
> extends PromiseEnts<EntsDataModel, Table> {
  // This just returns the first retrieved document, or throws if there
  // are no documents. It does not optimize the previous steps in the query.
  firstX(): PromiseEntWriter<EntsDataModel, Table>;

  // This just returns the unique retrieved document, or throws if there
  // are no documents. It does not optimize the previous steps in the query.
  // Otherwise it behaves like db.query().unique().
  uniqueX(): PromiseEntWriter<EntsDataModel, Table>;
}

export interface PromiseTableWriter<
  Table extends TableNamesInDataModel<EntsDataModel>,
  EntsDataModel extends GenericEntsDataModel
> extends PromiseQueryWriter<EntsDataModel, Table>,
    PromiseTableBase<EntsDataModel, Table> {
  /**
   * Fetch a document from the DB using given index, throw if it doesn't exist.
   */
  getX<
    Indexes extends EntsDataModel[Table]["indexes"],
    Index extends keyof Indexes
  >(
    indexName: Index,
    // TODO: Figure out how to make this variadic
    value0: FieldTypeFromFieldPath<
      DocumentByName<EntsDataModel, Table>,
      Indexes[Index][0]
    >
  ): PromiseEnt<EntsDataModel, Table>;
  /**
   * Fetch a document from the DB for a given ID, throw if it doesn't exist.
   */
  getX(id: GenericId<Table>): PromiseEntWriter<EntsDataModel, Table>;

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
    IndexName extends SearchIndexNames<NamedTableInfo<EntsDataModel, Table>>
  >(
    indexName: IndexName,
    searchFilter: (
      q: SearchFilterBuilder<
        DocumentByName<EntsDataModel, Table>,
        NamedSearchIndex<NamedTableInfo<EntsDataModel, Table>, IndexName>
      >
    ) => SearchFilter
  ): PromiseOrderedQueryWriter<EntsDataModel, Table>;

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
        DocumentByName<EntsDataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >
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
    values: WithoutSystemFields<
      WithEdges<
        DocumentByName<EntsDataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >[]
  ): Promise<GenericId<Table>[]>;
}

class PromiseTableWriterImpl<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
> extends PromiseTableImpl<EntsDataModel, Table> {
  private base: WriterImplBase<EntsDataModel, Table>;

  constructor(
    protected ctx: GenericMutationCtx<EntsDataModel>,
    entDefinitions: EntsDataModel,
    table: Table
  ) {
    super(ctx, entDefinitions, table);
    this.base = new WriterImplBase(ctx, entDefinitions, table);
  }

  insert(
    value: WithoutSystemFields<
      WithEdges<
        DocumentByName<EntsDataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >
  ) {
    return new PromiseEntIdImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        await this.base.checkReadAndWriteRule(undefined, value);
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
        DocumentByName<EntsDataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >[]
  ) {
    return await Promise.all(values.map((value) => this.insert(value)));
  }
}

export interface PromiseEntWriter<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
> extends Promise<
    EntWriter<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>
  > {
  edge<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge
  ): PromiseEdge<EntsDataModel, Table, Edge>;

  edgeX<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge
  ): PromiseEdgeOrThrow<EntsDataModel, Table, Edge>;

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
    >
  ): Promise<PromiseEntId<EntsDataModel, Table>>;

  /**
   * Replace the value of an existing document, overwriting its old value.
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
    >
  ): Promise<PromiseEntId<EntsDataModel, Table>>;

  /**
   * Delete this existing document.
   *
   * @param id - The {@link GenericId} of the document to remove.
   */
  delete(): Promise<GenericId<Table>>;
}

class PromiseEntWriterImpl<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
> extends PromiseEntOrNullImpl<EntsDataModel, Table> {
  private base: WriterImplBase<EntsDataModel, Table>;

  constructor(
    protected ctx: GenericMutationCtx<EntsDataModel>,
    protected entDefinitions: EntsDataModel,
    protected table: Table,
    protected retrieve: DocRetriever<
      GenericId<Table> | null,
      DocumentByName<EntsDataModel, Table> | null
    >,
    protected throwIfNull: boolean
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
    >
  ) {
    return new PromiseEntIdImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const { id: docId } = await this.retrieve();
        const id = docId!;
        await this.base.checkReadAndWriteRule(id, value);
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
        DocumentByName<EntsDataModel, Table>,
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
        const docId = id!;
        await this.base.checkReadAndWriteRule(docId, value);
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
    const { id: docId } = await this.retrieve();
    const id = docId!;
    await this.base.checkReadAndWriteRule(id, undefined);
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
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
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
    >
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
    >
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
  EntsDataModel extends GenericEntsDataModel
> = Doc & EntWriterInstance<EntsDataModel, Table>;

export type GenericEntWriter<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
> = EntWriter<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>;

interface PromiseEntId<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
> extends Promise<GenericId<Table>> {
  get(): PromiseEntWriter<EntsDataModel, Table>;
}

class PromiseEntIdImpl<
    EntsDataModel extends GenericEntsDataModel,
    Table extends TableNamesInDataModel<EntsDataModel>
  >
  extends Promise<GenericId<Table>>
  implements PromiseEntId<EntsDataModel, Table>
{
  constructor(
    private ctx: GenericMutationCtx<EntsDataModel>,
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
      },
      true
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

// function idRetriever<
//   DataModel extends GenericDataModel,
//   Table extends TableNamesInDataModel<DataModel>
// >(ctx: GenericQueryCtx<DataModel>, id: GenericId<Table>) {
//   return {
//     id,
//     doc: async () => ctx.db.get(id),
//   };
// }

function loadedRetriever<
  DataModel extends GenericDataModel,
  Table extends TableNamesInDataModel<DataModel>
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
    doc: GenericDocument | undefined,
    changes: Partial<GenericDocument> | undefined
  ) => Promise<boolean>;
};

export function addEntRules<EntsDataModel extends GenericEntsDataModel>(
  entDefinitions: EntsDataModel,
  rules: {
    [Table in keyof EntsDataModel]?: Table extends TableNamesInDataModel<EntsDataModel>
      ? {
          read?: (
            ent: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>
          ) => Promise<boolean>;
          write?: (
            ent:
              | Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>
              | undefined,
            changes: Partial<
              WithEdgePatches<
                DocumentByName<EntsDataModel, Table>,
                EntsDataModel[Table]["edges"]
              >
            >
          ) => Promise<boolean>;
        }
      : never;
  }
): EntsDataModel {
  return { ...entDefinitions, rules };
}

async function filterByReadRule(
  ctx: GenericQueryCtx<any>,
  entDefinitions: GenericEntsDataModel,
  table: string,
  docs: GenericDocument[] | null,
  throwIfNull: boolean
) {
  if (docs === null) {
    return null;
  }
  const readPolicy = getReadRule(entDefinitions, table);
  if (readPolicy !== undefined) {
    const decisions = await Promise.all(
      docs.map(async (doc) => {
        const decision = await readPolicy(
          entWrapper(doc, ctx, entDefinitions, table)
        );
        if (throwIfNull && !decision) {
          throw new Error(
            `Document cannot be read with id \`${
              doc._id as string
            }\` in table "${table}"`
          );
        }
        return decision;
      })
    );
    return docs.filter((_, i) => decisions[i]);
  }
  return docs;
}

export function getReadRule(
  entDefinitions: GenericEntsDataModel,
  table: string
) {
  return (entDefinitions.rules as Rules)?.[table]?.read;
}

export function getWriteRule(
  entDefinitions: GenericEntsDataModel,
  table: string
) {
  return (entDefinitions.rules as Rules)?.[table]?.write;
}
