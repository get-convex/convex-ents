import {
  DocumentByName,
  ExpressionOrValue,
  FieldTypeFromFieldPath,
  FilterBuilder,
  FunctionReference,
  GenericActionCtx,
  GenericDataModel,
  GenericDocument,
  IndexNames,
  IndexRange,
  IndexRangeBuilder,
  NamedIndex,
  NamedSearchIndex,
  NamedTableInfo,
  PaginationOptions,
  PaginationResult,
  SearchFilter,
  SearchFilterBuilder,
  SearchIndexNames,
  TableNamesInDataModel,
  WithOptionalSystemFields,
  WithoutSystemFields,
  makeFunctionReference,
} from "convex/server";
import { GenericId, JSONValue, NumericValue, Value } from "convex/values";
import { Ent, EntsTable, EntsTableWriter } from "./functions";
import { Expand, GenericEdgeConfig, GenericEntsDataModel } from "./schema";
import {
  EntsSystemDataModel,
  IndexFieldTypesForEq,
  PromiseEdgeResult,
  getEdgeDefinitions,
} from "./shared";
import { WithEdgeInserts, WithEdgePatches, WithEdges } from "./writer";

export interface EntActionCtx<DataModel extends GenericDataModel> {
  runQuery: GenericActionCtx<DataModel>["runQuery"];
  runMutation: GenericActionCtx<DataModel>["runMutation"];
  vectorSearch: GenericActionCtx<DataModel>["vectorSearch"];
}

export type ActionReadFuncRef = FunctionReference<
  "query",
  "internal",
  {
    read: SerializedRead;
  },
  any
>;

export type ActionWriteFuncRef = FunctionReference<
  "mutation",
  "internal",
  {
    write: SerializedWrite;
  },
  any
>;

type SerializedRead = (
  | { table: [string, string?, ReadonlyArray<SerializedRangeExpression>?] }
  | { search: [string, ReadonlyArray<SerializedSearchFilter>] }
  | { order: ["asc" | "desc", string?] }
  | { normalizeId: string }
  | { normalizeIdX: string }
  | { get: any[] }
  | { getX: any[] }
  | { getMany: any[] }
  | { getManyX: any[] }
  | { filter: JSONValue }
  | { take: number }
  | { paginate: PaginationOptions }
  | { first: true }
  | { firstX: true }
  | { unique: true }
  | { uniqueX: true }
  | { edge: string }
  | { edgeX: string }
  | { has: GenericId<any> }
)[];

type SerializedWrite = (
  | SerializedRead[number]
  | { insert: WithoutSystemFields<WithEdgeInserts<GenericDocument, any>> }
  | { insertMany: WithoutSystemFields<WithEdgeInserts<GenericDocument, any>>[] }
  | { patch: Partial<WithEdgePatches<GenericDocument, any>> }
  | { replace: WithOptionalSystemFields<WithEdges<GenericDocument, any>> }
  | { delete: true }
)[];

type SerializedRangeExpression = {
  type: "Eq" | "Gt" | "Gte" | "Lt" | "Lte";
  fieldPath: string;
  value: JSONValue;
};

export async function entsActionReadFactory(
  ctx: {
    table: EntsTable<any>;
  },
  args_: {
    [key: string]: unknown;
  },
) {
  const { read } = args_ as { read: SerializedRead };
  let result: any;
  for (const call of read) {
    result = addMethodCall(ctx as any, call, result);
  }
  return await result;
}

export async function entsActionWriteFactory(
  ctx: {
    table: EntsTableWriter<any>;
  },
  args_: {
    [key: string]: unknown;
  },
) {
  const { write } = args_ as { write: SerializedWrite };
  let result: any;
  for (const call of write) {
    result = addMethodCall(ctx as any, call, result);
  }
  return await result;
}

function addMethodCall(
  ctx: {
    table: EntsTableWriter<any>;
  },
  call: SerializedWrite[number],
  result: any,
) {
  if ("table" in call) {
    const [table, indexName, indexRange] = call.table;
    return ctx.table(table, indexName!, deserializeIndexRange(indexRange));
  } else if ("search" in call) {
    const [indexName, filters] = call.search;
    return result.search(indexName, deserializeSearchFilter(filters));
  } else if ("normalizeId" in call) {
    return result.normalizeId(call.normalizeId);
  } else if ("normalizeIdX" in call) {
    return result.normalizeIdX(call.normalizeIdX);
  } else if ("get" in call) {
    return result.get(...call.get);
  } else if ("getX" in call) {
    return result.getX(...call.getX);
  } else if ("getMany" in call) {
    return result.getMany(...call.getMany);
  } else if ("getManyX" in call) {
    return result.getManyX(...call.getManyX);
  } else if ("filter" in call) {
    return result.filter(deserializeFilterPredicate(call.filter));
  } else if ("order" in call) {
    return result.order(...call.order);
  } else if ("take" in call) {
    return result.take(call.take);
  } else if ("paginate" in call) {
    return result.paginate(call.paginate);
  } else if ("first" in call) {
    return result.first();
  } else if ("firstX" in call) {
    return result.firstX();
  } else if ("unique" in call) {
    return result.unique();
  } else if ("uniqueX" in call) {
    return result.uniqueX();
  } else if ("edge" in call) {
    return result.edge(call.edge);
  } else if ("edgeX" in call) {
    return result.edge(call.edgeX);
  } else if ("has" in call) {
    return result.has(call.has);
  } else if ("insert" in call) {
    return result.insert(call.insert);
  } else if ("insertMany" in call) {
    return result.insertMany(call.insertMany);
  } else if ("patch" in call) {
    return result.patch(call.patch);
  } else if ("replace" in call) {
    return result.replace(call.replace);
  } else if ("delete" in call) {
    return result.delete();
  } else {
    call satisfies never;
  }
}

export type EntsTableAction<EntsDataModel extends GenericEntsDataModel> = {
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
  ): PromiseTableAction<Table, EntsDataModel>;
  <Table extends TableNamesInDataModel<EntsDataModel>>(
    table: Table,
  ): PromiseTableAction<Table, EntsDataModel>;

  // TODO: Allow only reads
  system: EntsTableAction<EntsSystemDataModel>;
};

export interface PromiseTableAction<
  Table extends TableNamesInDataModel<EntsDataModel>,
  EntsDataModel extends GenericEntsDataModel,
> extends PromiseQueryAction<EntsDataModel, Table> {
  /**
   * If given a valid ID for the given table, returns it, or returns null if the ID
   * is from a different table or is not a valid ID.
   *
   * This does not guarantee that the ID exists (i.e. `table("foo").get(id)` may return `null`).
   */
  normalizeId(id: string): Promise<GenericId<Table> | null>;

  /**
   * If given a valid ID for the given table, returns it, or throws if the ID
   * is from a different table or is not a valid ID.
   *
   * This does not guarantee that the ID exists (i.e. `table("foo").get(id)` may return `null`).
   */
  normalizeIdX(id: string): Promise<GenericId<Table>>;

  get<
    Indexes extends EntsDataModel[Table]["indexes"],
    Index extends keyof Indexes,
  >(
    indexName: Index,
    ...values: IndexFieldTypesForEq<EntsDataModel, Table, Indexes[Index]>
  ): PromiseEntActionOrNull<EntsDataModel, Table>;
  get(id: GenericId<Table>): PromiseEntActionOrNull<EntsDataModel, Table>;
  /**
   * Fetch a unique document from the DB using given index, throw if it doesn't exist.
   */
  getX<
    Indexes extends EntsDataModel[Table]["indexes"],
    Index extends keyof Indexes,
  >(
    indexName: Index,
    ...values: IndexFieldTypesForEq<EntsDataModel, Table, Indexes[Index]>
  ): PromiseEntAction<EntsDataModel, Table>;
  /**
   * Fetch a document from the DB for a given ID, throw if it doesn't exist.
   */
  getX(id: GenericId<Table>): PromiseEntAction<EntsDataModel, Table>;

  getMany<
    Indexes extends EntsDataModel[Table]["indexes"],
    Index extends keyof Indexes,
  >(
    indexName: Index,
    values: FieldTypeFromFieldPath<
      DocumentByName<EntsDataModel, Table>,
      Indexes[Index][0]
    >[],
  ): PromiseEntsActionOrNulls<EntsDataModel, Table>;
  getMany(
    ids: GenericId<Table>[],
  ): PromiseEntsActionOrNulls<EntsDataModel, Table>;
  getManyX<
    Indexes extends EntsDataModel[Table]["indexes"],
    Index extends keyof Indexes,
  >(
    indexName: Index,
    values: FieldTypeFromFieldPath<
      DocumentByName<EntsDataModel, Table>,
      Indexes[Index][0]
    >[],
  ): PromiseEntsAction<EntsDataModel, Table>;
  getManyX(ids: GenericId<Table>[]): PromiseEntsAction<EntsDataModel, Table>;

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
  ): PromiseOrderedQueryAction<EntsDataModel, Table>;
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
  ): PromiseEntIdAction<EntsDataModel, Table>;
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

export interface PromiseEntIdAction<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<GenericId<Table>> {
  get(): Promise<DocumentByName<EntsDataModel, Table>>;
}

export interface PromiseEntActionOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<DocumentByName<EntsDataModel, Table> | null> {
  edge<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge,
  ): PromiseEdgeActionOrNull<EntsDataModel, Table, Edge>;
}

export interface PromiseEntAction<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<DocumentByName<EntsDataModel, Table>> {
  edge<Edge extends keyof EntsDataModel[Table]["edges"]>(
    edge: Edge,
  ): PromiseEdgeAction<EntsDataModel, Table, Edge>;
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
  ): PromiseEntIdAction<EntsDataModel, Table>;

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
  ): PromiseEntIdAction<EntsDataModel, Table>;

  /**
   * Delete this existing document.
   *
   * @param id - The {@link GenericId} of the document to remove.
   */
  delete(): Promise<GenericId<Table>>;
}

export interface PromiseEntsActionOrNulls<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<(DocumentByName<EntsDataModel, Table> | null)[]> {}

export interface PromiseEntsActionOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<DocumentByName<EntsDataModel, Table>[] | null> {}

export interface PromiseEntsAction<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<DocumentByName<EntsDataModel, Table>[]> {}

export type PromiseEdgeAction<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
  Edge extends keyof EntsDataModel[Table]["edges"],
  Config extends GenericEdgeConfig = EntsDataModel[Table]["edges"][Edge],
  ToTable extends
    TableNamesInDataModel<EntsDataModel> = EntsDataModel[Table]["edges"][Edge]["to"],
> = PromiseEdgeResult<
  Config,
  PromiseEdgeEntsAction<EntsDataModel, ToTable>,
  PromiseQueryAction<EntsDataModel, ToTable>,
  PromiseEntActionOrNull<EntsDataModel, ToTable>,
  PromiseEntAction<EntsDataModel, ToTable>
>;

export type PromiseEdgeActionOrThrow<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
  Edge extends keyof EntsDataModel[Table]["edges"],
  Config extends GenericEdgeConfig = EntsDataModel[Table]["edges"][Edge],
  ToTable extends
    TableNamesInDataModel<EntsDataModel> = EntsDataModel[Table]["edges"][Edge]["to"],
> = PromiseEdgeResult<
  Config,
  PromiseEdgeEntsAction<EntsDataModel, ToTable>,
  PromiseQueryAction<EntsDataModel, ToTable>,
  PromiseEntAction<EntsDataModel, ToTable>,
  PromiseEntAction<EntsDataModel, ToTable>
>;

export type PromiseEdgeActionOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
  Edge extends keyof EntsDataModel[Table]["edges"],
  Config extends GenericEdgeConfig = EntsDataModel[Table]["edges"][Edge],
  ToTable extends
    TableNamesInDataModel<EntsDataModel> = EntsDataModel[Table]["edges"][Edge]["to"],
> = PromiseEdgeResult<
  Config,
  PromiseEdgeEntsActionOrNull<EntsDataModel, ToTable>,
  PromiseQueryActionOrNull<EntsDataModel, ToTable>,
  PromiseEntActionOrNull<EntsDataModel, ToTable>,
  PromiseEntActionOrNull<EntsDataModel, ToTable>
>;

export interface PromiseEdgeOrderedEntsActionOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends PromiseEntsActionOrNull<EntsDataModel, Table> {
  /**
   * Paginate the ents on the other end of the edge.
   * Results are ordered by edge's `_creationTime`.
   */
  paginate(
    paginationOpts: PaginationOptions,
  ): PromisePaginationResultActionOrNull<EntsDataModel, Table>;

  /**
   * Take the first `n` ents on the other end of the edge
   * ordered by edge's `_creationTime`.
   */
  take(n: number): PromiseEntsActionOrNull<EntsDataModel, Table>;

  /**
   * Returns the first ent on the other end of the edge
   * ordered by edge's `_creationTime`, or `null`.
   */
  first(): PromiseEntActionOrNull<EntsDataModel, Table>;

  /**
   * Returns the only ent on the other end of the edge,
   * `null` if there are none, or throws if there are more than one.
   */
  unique(): PromiseEntActionOrNull<EntsDataModel, Table>;
}

export interface PromiseEdgeEntsActionOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends PromiseEdgeOrderedEntsActionOrNull<EntsDataModel, Table> {
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
  ): PromiseEdgeOrderedEntsActionOrNull<EntsDataModel, Table>;
}

export interface PromiseEdgeOrderedEntsAction<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends PromiseEntsAction<EntsDataModel, Table> {
  /**
   * Paginate the ents on the other end of the edge.
   * Results are ordered by edge's `_creationTime`.
   */
  paginate(
    paginationOpts: PaginationOptions,
  ): PromisePaginationResultAction<EntsDataModel, Table>;

  /**
   * Take the first `n` ents on the other end of the edge
   * ordered by edge's `_creationTime`.
   */
  take(n: number): PromiseEntsAction<EntsDataModel, Table>;

  /**
   * Returns the first ent on the other end of the edge
   * ordered by edge's `_creationTime`, or `null`.
   */
  first(): PromiseEntActionOrNull<EntsDataModel, Table>;

  /**
   * Returns the first ent on the other end of the edge
   * ordered by edge's `_creationTime`, or throws if there
   * are no ents on the other end of the edge.
   */
  firstX(): PromiseEntAction<EntsDataModel, Table>;

  /**
   * Returns the only ent on the other end of the edge,
   * `null` if there are none, or throws if there are more than one.
   */
  unique(): PromiseEntActionOrNull<EntsDataModel, Table>;

  /**
   * Returns the only ent on the other end of the edge,
   * or throws if there are none or more than one.
   */
  uniqueX(): PromiseEntAction<EntsDataModel, Table>;
}

export interface PromiseEdgeEntsAction<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends PromiseEdgeOrderedEntsAction<EntsDataModel, Table> {
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
  ): PromiseEdgeOrderedEntsAction<EntsDataModel, Table>;
}

export interface PromiseOrderedQueryAction<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<DocumentByName<EntsDataModel, Table>[]> {
  filter(
    predicate: (
      q: FilterBuilder<NamedTableInfo<EntsDataModel, Table>>,
    ) => ExpressionOrValue<boolean>,
  ): this;
  paginate(
    paginationOpts: PaginationOptions,
  ): PromisePaginationResultAction<EntsDataModel, Table>;
  take(n: number): PromiseEntsAction<EntsDataModel, Table>;
  first(): PromiseEntActionOrNull<EntsDataModel, Table>;
  firstX(): PromiseEntAction<EntsDataModel, Table>;
  unique(): PromiseEntActionOrNull<EntsDataModel, Table>;
  uniqueX(): PromiseEntAction<EntsDataModel, Table>;
}

export interface PromiseQueryAction<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends PromiseOrderedQueryAction<EntsDataModel, Table> {
  order(
    order: "asc" | "desc",
    indexName?: IndexNames<NamedTableInfo<EntsDataModel, Table>>,
  ): PromiseOrderedQueryAction<EntsDataModel, Table>;
}

export interface PromisePaginationResultActionOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<PaginationResult<
    DocumentByName<EntsDataModel, Table>
  > | null> {}

export interface PromisePaginationResultAction<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<PaginationResult<DocumentByName<EntsDataModel, Table>>> {}

export interface PromiseOrderedQueryActionOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<DocumentByName<EntsDataModel, Table>[] | null> {
  filter(
    predicate: (
      q: FilterBuilder<NamedTableInfo<EntsDataModel, Table>>,
    ) => ExpressionOrValue<boolean>,
  ): this;
  paginate(
    paginationOpts: PaginationOptions,
  ): PromisePaginationResultActionOrNull<EntsDataModel, Table>;
  take(n: number): PromiseEntsActionOrNull<EntsDataModel, Table>;
  first(): PromiseEntActionOrNull<EntsDataModel, Table>;
  unique(): PromiseEntActionOrNull<EntsDataModel, Table>;
}

export interface PromiseQueryActionOrNull<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends PromiseOrderedQueryActionOrNull<EntsDataModel, Table> {
  // TODO: The index variant should not be allowed if
  // this query already used an index
  order(
    order: "asc" | "desc",
    indexName?: IndexNames<NamedTableInfo<EntsDataModel, Table>>,
  ): PromiseOrderedQueryActionOrNull<EntsDataModel, Table>;
}

class PromiseQueryActionOrNullImpl<
    EntsDataModel extends GenericEntsDataModel,
    Table extends TableNamesInDataModel<EntsDataModel>,
  >
  extends Promise<DocumentByName<EntsDataModel, Table>[] | null>
  implements PromiseQueryActionOrNull<EntsDataModel, Table>
{
  constructor(
    protected ctx: EntActionCtx<EntsDataModel>,
    protected entDefinitions: EntsDataModel,
    protected table: Table,
    protected read: SerializedRead,
  ) {
    super(() => {});
  }

  filter(
    predicate: (
      q: FilterBuilder<NamedTableInfo<EntsDataModel, Table>>,
    ) => ExpressionOrValue<boolean>,
  ): any {
    return new PromiseQueryActionOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      this.read.concat({ filter: serializeFilterPredicate(predicate) }),
    );
  }

  order(
    order: "asc" | "desc",
    indexName?: IndexNames<NamedTableInfo<EntsDataModel, Table>>,
  ): any {
    return new PromiseQueryActionOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      this.read.concat({
        order: [
          order,
          ...(indexName === undefined
            ? ([] as const)
            : ([indexName as string | undefined] as const)),
        ],
      }),
    );
  }

  paginate(paginationOpts: PaginationOptions) {
    return new PromisePaginationResultActionOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      this.read.concat({ paginate: paginationOpts }),
    );
  }

  async take(n: number) {
    return await runRead(this.ctx, this.read.concat({ take: n }));
  }

  first() {
    return new PromiseEntActionImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      this.read.concat({ first: true }),
    ) as any;
  }

  firstX() {
    return new PromiseEntActionImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      this.read.concat({ firstX: true }),
    ) as any;
  }

  unique() {
    return new PromiseEntActionImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      this.read.concat({ unique: true }),
    ) as any;
  }

  uniqueX() {
    return new PromiseEntActionImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      this.read.concat({ uniqueX: true }),
    ) as any;
  }

  then<
    TResult1 = DocumentByName<EntsDataModel, Table>[] | null,
    TResult2 = never,
  >(
    onfulfilled?:
      | ((
          value: DocumentByName<EntsDataModel, Table>[] | null,
        ) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null,
  ): Promise<TResult1 | TResult2> {
    const docs = runRead(this.ctx, this.read);
    return docs.then(onfulfilled, onrejected);
  }
}

class PromiseEdgeActionOrNullImpl<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends PromiseQueryActionOrNullImpl<EntsDataModel, Table> {
  async has(targetId: GenericId<Table>) {
    return runRead(this.ctx, this.read.concat({ has: targetId }));
  }
}

export class PromiseTableActionImpl<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends PromiseQueryActionOrNullImpl<EntsDataModel, Table> {
  constructor(
    ctx: EntActionCtx<EntsDataModel>,
    entDefinitions: EntsDataModel,
    table: Table,
  ) {
    super(ctx, entDefinitions, table, [{ table: [table] }]);
  }

  get(...args: any[]) {
    return new PromiseEntActionImpl(
      this.ctx as any,
      this.entDefinitions,
      this.table,
      this.read.concat({ get: args }),
    );
  }

  getX(...args: any[]) {
    return new PromiseEntActionImpl(
      this.ctx as any,
      this.entDefinitions,
      this.table,
      this.read.concat({ getX: args }),
    );
  }

  async getMany(...args: any[]) {
    return await runRead(this.ctx, this.read.concat({ getMany: args }));
  }

  async getManyX(...args: any[]) {
    return await runRead(this.ctx, this.read.concat({ getManyX: args }));
  }

  async normalizeId(id: string): Promise<GenericId<Table> | null> {
    return await runRead(this.ctx, this.read.concat({ normalizeId: id }));
  }

  async normalizeIdX(id: string): Promise<GenericId<Table>> {
    return await runRead(this.ctx, this.read.concat({ normalizeIdX: id }));
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
    return new PromiseQueryActionOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      [
        {
          table: [
            this.table,
            indexName as string | undefined,
            serializeIndexRange(indexRange),
          ],
        },
      ],
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
    return new PromiseQueryActionOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      this.read.concat({
        search: [indexName as string, serializeSearchFilter(searchFilter)],
      }),
    );
  }

  insert(
    value: WithoutSystemFields<
      WithEdgeInserts<
        DocumentByName<EntsDataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >,
  ) {
    return new PromiseEntIdActionImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      (this.read as SerializedWrite).concat({ insert: value }),
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
    return await runWrite(
      this.ctx,
      (this.read as SerializedWrite).concat({ insertMany: values }),
    );
  }
}

class PromisePaginationResultActionOrNullImpl<
    EntsDataModel extends GenericEntsDataModel,
    Table extends TableNamesInDataModel<EntsDataModel>,
  >
  extends Promise<PaginationResult<DocumentByName<EntsDataModel, Table>> | null>
  implements PromisePaginationResultActionOrNull<EntsDataModel, Table>
{
  constructor(
    private ctx: EntActionCtx<EntsDataModel>,
    private entDefinitions: EntsDataModel,
    private table: Table,
    private read: SerializedRead,
  ) {
    super(() => {});
  }

  then<
    TResult1 = DocumentByName<EntsDataModel, Table>[] | null,
    TResult2 = never,
  >(
    onfulfilled?:
      | ((
          value: PaginationResult<DocumentByName<EntsDataModel, Table>> | null,
        ) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null,
  ): Promise<TResult1 | TResult2> {
    return runRead(this.ctx, this.read).then(onfulfilled, onrejected);
  }
}

class PromiseEntActionImpl<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
> extends Promise<DocumentByName<EntsDataModel, Table> | null> {
  constructor(
    protected ctx: EntActionCtx<EntsDataModel>,
    protected entDefinitions: EntsDataModel,
    protected table: Table,
    protected read: SerializedRead,
  ) {
    super(() => {});
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
    return runRead(this.ctx, this.read).then(onfulfilled, onrejected);
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
    const read = throwIfNull
      ? { edgeX: edge as string }
      : { edge: edge as string };

    if (edgeDefinition.cardinality === "multiple") {
      if (edgeDefinition.type === "ref") {
        return new PromiseEdgeActionOrNullImpl(
          this.ctx,
          this.entDefinitions,
          edgeDefinition.to,
          this.read.concat(read),
        ) as any;
      }
      return new PromiseQueryActionOrNullImpl(
        this.ctx,
        this.entDefinitions,
        edgeDefinition.to,
        this.read.concat(read),
      ) as any;
    }

    return new PromiseEntActionImpl(
      this.ctx as any,
      this.entDefinitions,
      edgeDefinition.to,
      this.read.concat(read),
    ) as any;
  }

  patch(
    value: Partial<
      WithEdgePatches<
        DocumentByName<EntsDataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >,
  ) {
    return new PromiseEntIdActionImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      (this.read as SerializedWrite).concat({ patch: value }),
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
    return new PromiseEntIdActionImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      (this.read as SerializedWrite).concat({ replace: value }),
    );
  }

  async delete() {
    return await runWrite(
      this.ctx,
      (this.read as SerializedWrite).concat({ delete: true }),
    );
  }
}

class PromiseEntIdActionImpl<
    EntsDataModel extends GenericEntsDataModel,
    Table extends TableNamesInDataModel<EntsDataModel>,
  >
  extends Promise<GenericId<Table>>
  implements PromiseEntIdAction<EntsDataModel, Table>
{
  constructor(
    private ctx: EntActionCtx<EntsDataModel>,
    private entDefinitions: EntsDataModel,
    private table: Table,
    private write: SerializedWrite,
  ) {
    super(() => {});
  }

  async get() {
    return await runWrite(this.ctx, this.write.concat({ get: [] }));
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
    return runWrite(this.ctx, this.write).then(onfulfilled, onrejected);
  }
}

async function runRead(ctx: EntActionCtx<any>, read: SerializedRead) {
  const readRef =
    (ctx as any)?.actionRead ??
    (makeFunctionReference("functions:read") as unknown as ActionReadFuncRef);
  return await ctx.runQuery(readRef, { read });
}

async function runWrite(ctx: EntActionCtx<any>, write: SerializedWrite) {
  const writeRef =
    (ctx as any)?.actionRead ??
    (makeFunctionReference("functions:write") as unknown as ActionWriteFuncRef);
  return await ctx.runMutation(writeRef, { write });
}

class IndexRangeBuilderImpl {
  private constructor(
    public rangeExpressions: ReadonlyArray<SerializedRangeExpression>,
  ) {}

  static new(): IndexRangeBuilderImpl {
    return new IndexRangeBuilderImpl([]);
  }

  eq(fieldName: string, value: Value) {
    return new IndexRangeBuilderImpl(
      this.rangeExpressions.concat({
        type: "Eq",
        fieldPath: fieldName,
        value: value === undefined ? "$undefined" : (value as any),
      }),
    );
  }

  gt(fieldName: string, value: Value) {
    return new IndexRangeBuilderImpl(
      this.rangeExpressions.concat({
        type: "Gt",
        fieldPath: fieldName,
        value: value as any,
      }),
    );
  }
  gte(fieldName: string, value: Value) {
    return new IndexRangeBuilderImpl(
      this.rangeExpressions.concat({
        type: "Gte",
        fieldPath: fieldName,
        value: value as any,
      }),
    );
  }
  lt(fieldName: string, value: Value) {
    return new IndexRangeBuilderImpl(
      this.rangeExpressions.concat({
        type: "Lt",
        fieldPath: fieldName,
        value: value as any,
      }),
    );
  }
  lte(fieldName: string, value: Value) {
    return new IndexRangeBuilderImpl(
      this.rangeExpressions.concat({
        type: "Lte",
        fieldPath: fieldName,
        value: value as any,
      }),
    );
  }
}

function serializeIndexRange(
  indexRange?: (q: IndexRangeBuilder<any, any>) => IndexRange,
): Readonly<SerializedRangeExpression[]> | undefined {
  if (indexRange === undefined) {
    return undefined;
  }
  return (
    indexRange?.(
      IndexRangeBuilderImpl.new() as any,
    ) as unknown as IndexRangeBuilderImpl
  ).rangeExpressions;
}

function deserializeIndexRange(
  rangeExpressions: Readonly<SerializedRangeExpression[]> | undefined,
) {
  if (rangeExpressions === undefined) {
    return undefined;
  }
  return (q: any) => {
    for (const range of rangeExpressions) {
      switch (range.type) {
        case "Eq":
          q = q.eq(
            range.fieldPath,
            range.value === "$undefined" ? undefined : range.value,
          );
          break;
        case "Gt":
          q = q.gt(range.fieldPath, range.value);
          break;
        case "Gte":
          q = q.gte(range.fieldPath, range.value);
          break;
        case "Lt":
          q = q.lt(range.fieldPath, range.value);
          break;
        case "Lte":
          q = q.lte(range.fieldPath, range.value);
          break;
      }
    }
    return q;
  };
}

function serializeFilterPredicate(
  predicate: (q: FilterBuilder<any>) => ExpressionOrValue<boolean>,
) {
  return serializeExpression(predicate(filterBuilderImpl as any));
}

function deserializeFilterPredicate(predicate: JSONValue) {
  return (q: any) => deserializeFilterExpression(q, predicate);
}

const binaryOps = [
  "eq",
  "neq",
  "lt",
  "lte",
  "gt",
  "gte",
  "add",
  "sub",
  "mul",
  "div",
  "mod",
  "and",
  "or",
] as const;

function deserializeFilterExpression(
  q: FilterBuilder<any>,
  expression: any,
): ExpressionOrValue<any> {
  if ("field" in expression) {
    const fieldPath = expression["field"];
    return q.field(fieldPath);
  }
  if ("literal" in expression) {
    const literal = expression["literal"];
    return literal === "$undefined" ? undefined : literal;
  }
  if ("neg" in expression) {
    return q.neg(deserializeFilterExpression(q, expression["neg"]));
  }
  if ("not" in expression) {
    return q.not(deserializeFilterExpression(q, expression["not"]));
  }
  for (const op of binaryOps) {
    if (op in expression) {
      const [l, r] = expression[op];
      return (q[op] as any)(
        deserializeFilterExpression(q, l),
        deserializeFilterExpression(q, r),
      );
    }
  }
  throw new Error(
    "Expected a valid filter expression, got " + JSON.stringify(expression),
  );
}

const filterBuilderImpl = {
  //  Comparisons  /////////////////////////////////////////////////////////////

  eq<T extends Value | undefined>(
    l: ExpressionOrValue<T>,
    r: ExpressionOrValue<T>,
  ): FilterExpression {
    return new FilterExpression({
      eq: [serializeExpression(l), serializeExpression(r)],
    });
  },

  neq<T extends Value | undefined>(
    l: ExpressionOrValue<T>,
    r: ExpressionOrValue<T>,
  ): FilterExpression {
    return new FilterExpression({
      neq: [serializeExpression(l), serializeExpression(r)],
    });
  },

  lt<T extends Value>(
    l: ExpressionOrValue<T>,
    r: ExpressionOrValue<T>,
  ): FilterExpression {
    return new FilterExpression({
      lt: [serializeExpression(l), serializeExpression(r)],
    });
  },

  lte<T extends Value>(
    l: ExpressionOrValue<T>,
    r: ExpressionOrValue<T>,
  ): FilterExpression {
    return new FilterExpression({
      lte: [serializeExpression(l), serializeExpression(r)],
    });
  },

  gt<T extends Value>(
    l: ExpressionOrValue<T>,
    r: ExpressionOrValue<T>,
  ): FilterExpression {
    return new FilterExpression({
      gt: [serializeExpression(l), serializeExpression(r)],
    });
  },

  gte<T extends Value>(
    l: ExpressionOrValue<T>,
    r: ExpressionOrValue<T>,
  ): FilterExpression {
    return new FilterExpression({
      gte: [serializeExpression(l), serializeExpression(r)],
    });
  },

  //  Arithmetic  //////////////////////////////////////////////////////////////

  add<T extends NumericValue>(
    l: ExpressionOrValue<T>,
    r: ExpressionOrValue<T>,
  ): FilterExpression {
    return new FilterExpression({
      add: [serializeExpression(l), serializeExpression(r)],
    });
  },

  sub<T extends NumericValue>(
    l: ExpressionOrValue<T>,
    r: ExpressionOrValue<T>,
  ): FilterExpression {
    return new FilterExpression({
      sub: [serializeExpression(l), serializeExpression(r)],
    });
  },

  mul<T extends NumericValue>(
    l: ExpressionOrValue<T>,
    r: ExpressionOrValue<T>,
  ): FilterExpression {
    return new FilterExpression({
      mul: [serializeExpression(l), serializeExpression(r)],
    });
  },

  div<T extends NumericValue>(
    l: ExpressionOrValue<T>,
    r: ExpressionOrValue<T>,
  ): FilterExpression {
    return new FilterExpression({
      div: [serializeExpression(l), serializeExpression(r)],
    });
  },

  mod<T extends NumericValue>(
    l: ExpressionOrValue<T>,
    r: ExpressionOrValue<T>,
  ): FilterExpression {
    return new FilterExpression({
      mod: [serializeExpression(l), serializeExpression(r)],
    });
  },

  neg<T extends NumericValue>(x: ExpressionOrValue<T>): FilterExpression {
    return new FilterExpression({ neg: serializeExpression(x) });
  },

  //  Logic  ///////////////////////////////////////////////////////////////////

  and(...exprs: Array<ExpressionOrValue<boolean>>): FilterExpression {
    return new FilterExpression({ and: exprs.map(serializeExpression) });
  },

  or(...exprs: Array<ExpressionOrValue<boolean>>): FilterExpression {
    return new FilterExpression({ or: exprs.map(serializeExpression) });
  },

  not(x: ExpressionOrValue<boolean>): FilterExpression {
    return new FilterExpression({ not: serializeExpression(x) });
  },

  //  Other  ///////////////////////////////////////////////////////////////////
  field(fieldPath: string): FilterExpression {
    return new FilterExpression({ field: fieldPath });
  },
};

export function serializeExpression(
  expr: ExpressionOrValue<Value | undefined>,
): JSONValue {
  if (expr instanceof FilterExpression) {
    return expr.serialize();
  } else {
    return {
      literal: expr === undefined ? "$undefined" : (expr as any),
    };
  }
}

class FilterExpression {
  private inner: JSONValue;
  constructor(inner: JSONValue) {
    this.inner = inner;
  }

  serialize(): JSONValue {
    return this.inner;
  }
}

function serializeSearchFilter(
  searchFilter: (q: SearchFilterBuilder<any, any>) => SearchFilter,
) {
  return (
    searchFilter(
      SearchFilterBuilderImpl.new() as any,
    ) as unknown as SearchFilterBuilderImpl
  ).export();
}

function deserializeSearchFilter(
  filters: ReadonlyArray<SerializedSearchFilter>,
) {
  return (q: any) => {
    for (const filter of filters) {
      switch (filter.type) {
        case "Search":
          q = q.search(filter.fieldPath, filter.value);
          break;
        case "Eq":
          q = q.eq(
            filter.fieldPath,
            filter.value === "$undefined" ? undefined : filter.value,
          );
          break;
      }
    }
    return q;
  };
}

export type SerializedSearchFilter =
  | {
      type: "Search";
      fieldPath: string;
      value: string;
    }
  | {
      type: "Eq";
      fieldPath: string;
      value: Value;
    };

class SearchFilterBuilderImpl {
  private constructor(public filters: ReadonlyArray<SerializedSearchFilter>) {}

  static new(): SearchFilterBuilderImpl {
    return new SearchFilterBuilderImpl([]);
  }

  search(fieldName: string, query: string) {
    return new SearchFilterBuilderImpl(
      this.filters.concat({
        type: "Search",
        fieldPath: fieldName,
        value: query,
      }),
    );
  }

  eq<FieldName extends string>(
    fieldName: FieldName,
    value: FieldTypeFromFieldPath<GenericDocument, FieldName>,
  ) {
    return new SearchFilterBuilderImpl(
      this.filters.concat({
        type: "Eq",
        fieldPath: fieldName,
        value: value === undefined ? "$undefiend" : value,
      }),
    );
  }

  export() {
    return this.filters;
  }
}
