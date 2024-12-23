import { GenericEntsDataModel, GenericEdgeConfig, Expand, DeletionConfig } from './schema.js';
import { TableNamesInDataModel, GenericDocument, DocumentByName, FilterBuilder, NamedTableInfo, ExpressionOrValue, PaginationOptions, IndexNames, FieldTypeFromFieldPath, SearchIndexNames, SearchFilterBuilder, NamedSearchIndex, SearchFilter, PaginationResult, IndexRangeBuilder, NamedIndex, IndexRange, WithoutSystemFields, WithOptionalSystemFields, GenericDataModel, GenericDatabaseReader, GenericDatabaseWriter, StorageWriter, Scheduler } from 'convex/server';
import { GenericId } from 'convex/values';
import { ScheduledDeleteFuncRef } from './deletion.js';
import { IndexFieldTypesForEq, EntsSystemDataModel, PromiseEdgeResult } from './shared.js';

declare class WriterImplBase<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> {
    protected ctx: EntMutationCtx<EntsDataModel>;
    protected entDefinitions: EntsDataModel;
    protected table: Table;
    constructor(ctx: EntMutationCtx<EntsDataModel>, entDefinitions: EntsDataModel, table: Table);
    deleteId(id: GenericId<any>, behavior: "default" | "soft" | "hard"): Promise<GenericId<any>>;
    deleteIdIn(id: GenericId<any>, table: string, cascadingSoft: boolean): Promise<void>;
    deleteSystem(table: string, id: GenericId<any>): Promise<void>;
    writeEdges(docId: GenericId<any>, changes: EdgeChanges, deleteSoftly?: boolean): Promise<void>;
    checkUniqueness(value: Partial<GenericDocument>, id?: GenericId<any>): Promise<void>;
    fieldsOnly(value: Partial<WithEdgePatches<DocumentByName<EntsDataModel, Table>, EntsDataModel[Table]["edges"]>>): GenericDocument;
    checkReadAndWriteRule(operation: "create" | "update" | "delete", id: GenericId<Table> | undefined, value: Partial<GenericDocument> | undefined): Promise<void>;
}
type WithEdgeInserts<Document extends GenericDocument, Edges extends Record<string, GenericEdgeConfig>> = Document & {
    [key in keyof Edges as Edges[key]["cardinality"] extends "single" ? Edges[key]["type"] extends "field" ? never : key : key]?: Edges[key]["cardinality"] extends "single" ? GenericId<Edges[key]["to"]> : GenericId<Edges[key]["to"]>[];
};
type WithEdges<Document extends GenericDocument, Edges extends Record<string, GenericEdgeConfig>> = Document & {
    [key in keyof Edges as Edges[key]["cardinality"] extends "multiple" ? Edges[key]["type"] extends "ref" ? key : never : never]?: GenericId<Edges[key]["to"]>[];
};
type WithEdgePatches<Document extends GenericDocument, Edges extends Record<string, GenericEdgeConfig>> = Document & {
    [key in keyof Edges as Edges[key]["cardinality"] extends "multiple" ? Edges[key]["type"] extends "ref" ? key : never : never]?: {
        add?: GenericId<Edges[key]["to"]>[];
        remove?: GenericId<Edges[key]["to"]>[];
    };
};
type EdgeChanges = Record<string, {
    add?: GenericId<any>[];
    remove?: GenericId<any>[];
    removeEdges?: GenericId<any>[];
}>;
declare function isSystemTable(table: string): boolean;

interface PromiseOrderedQueryOrNull<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends Promise<Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[] | null> {
    filter(predicate: (q: FilterBuilder<NamedTableInfo<EntsDataModel, Table>>) => ExpressionOrValue<boolean>): this;
    map<TOutput>(callbackFn: (value: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>, index: number, array: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]) => TOutput | Promise<TOutput>): PromiseArrayOrNull<TOutput>;
    paginate(paginationOpts: PaginationOptions): PromisePaginationResultOrNull<EntsDataModel, Table>;
    take(n: number): PromiseEntsOrNull<EntsDataModel, Table>;
    first(): PromiseEntOrNull<EntsDataModel, Table>;
    unique(): PromiseEntOrNull<EntsDataModel, Table>;
    docs(): Promise<DocumentByName<EntsDataModel, Table>[] | null>;
}
interface PromiseOrderedQueryWriterOrNull<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends Promise<Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[] | null> {
    filter(predicate: (q: FilterBuilder<NamedTableInfo<EntsDataModel, Table>>) => ExpressionOrValue<boolean>): this;
    map<TOutput>(callbackFn: (value: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>, index: number, array: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]) => Promise<TOutput> | TOutput): PromiseArrayOrNull<TOutput>;
    paginate(paginationOpts: PaginationOptions): PromisePaginationResultOrNull<EntsDataModel, Table>;
    take(n: number): PromiseEntsWriterOrNull<EntsDataModel, Table>;
    first(): PromiseEntWriterOrNull<EntsDataModel, Table>;
    unique(): PromiseEntWriterOrNull<EntsDataModel, Table>;
    docs(): Promise<DocumentByName<EntsDataModel, Table>[] | null>;
}
interface PromiseQueryOrNull<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends PromiseOrderedQueryOrNull<EntsDataModel, Table> {
    order(order: "asc" | "desc", indexName?: IndexNames<NamedTableInfo<EntsDataModel, Table>>): PromiseOrderedQueryOrNull<EntsDataModel, Table>;
}
interface PromiseQueryWriterOrNull<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends PromiseOrderedQueryWriterOrNull<EntsDataModel, Table> {
    order(order: "asc" | "desc", indexName?: IndexNames<NamedTableInfo<EntsDataModel, Table>>): PromiseOrderedQueryWriterOrNull<EntsDataModel, Table>;
}
interface PromiseTableBase<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> {
    getMany<Indexes extends EntsDataModel[Table]["indexes"], Index extends keyof Indexes>(indexName: Index, values: FieldTypeFromFieldPath<DocumentByName<EntsDataModel, Table>, Indexes[Index][0]>[]): PromiseEntsOrNulls<EntsDataModel, Table>;
    getMany(ids: GenericId<Table>[]): PromiseEntsOrNulls<EntsDataModel, Table>;
    getManyX<Indexes extends EntsDataModel[Table]["indexes"], Index extends keyof Indexes>(indexName: Index, values: FieldTypeFromFieldPath<DocumentByName<EntsDataModel, Table>, Indexes[Index][0]>[]): PromiseEnts<EntsDataModel, Table>;
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
interface PromiseTable<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends PromiseQuery<EntsDataModel, Table>, PromiseTableBase<EntsDataModel, Table> {
    get<Indexes extends EntsDataModel[Table]["indexes"], Index extends keyof Indexes>(indexName: Index, ...values: IndexFieldTypesForEq<EntsDataModel, Table, Indexes[Index]>): PromiseEntOrNull<EntsDataModel, Table>;
    get(id: GenericId<Table>): PromiseEntOrNull<EntsDataModel, Table>;
    /**
     * Fetch a unique document from the DB using given index, throw if it doesn't exist.
     */
    getX<Indexes extends EntsDataModel[Table]["indexes"], Index extends keyof Indexes>(indexName: Index, ...values: IndexFieldTypesForEq<EntsDataModel, Table, Indexes[Index]>): PromiseEnt<EntsDataModel, Table>;
    /**
     * Fetch a document from the DB for a given ID, throw if it doesn't exist.
     */
    getX(id: GenericId<Table>): PromiseEnt<EntsDataModel, Table>;
    /**
     * Return all documents in the table in given order.
     * Sort either by given index or by _creationTime.
     */
    order(order: "asc" | "desc", indexName?: IndexNames<NamedTableInfo<EntsDataModel, Table>>): PromiseOrderedQuery<EntsDataModel, Table>;
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
    search<IndexName extends SearchIndexNames<NamedTableInfo<EntsDataModel, Table>>>(indexName: IndexName, searchFilter: (q: SearchFilterBuilder<DocumentByName<EntsDataModel, Table>, NamedSearchIndex<NamedTableInfo<EntsDataModel, Table>, IndexName>>) => SearchFilter): PromiseOrderedQuery<EntsDataModel, Table>;
}
interface PromiseOrderedQueryBase<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> {
    filter(predicate: (q: FilterBuilder<NamedTableInfo<EntsDataModel, Table>>) => ExpressionOrValue<boolean>): this;
    docs(): Promise<DocumentByName<EntsDataModel, Table>[]>;
}
interface PromiseOrderedQuery<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends Promise<Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]>, PromiseOrderedQueryBase<EntsDataModel, Table> {
    map<TOutput>(callbackFn: (value: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>, index: number, array: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]) => Promise<TOutput> | TOutput): PromiseArray<TOutput>;
    paginate(paginationOpts: PaginationOptions): PromisePaginationResult<EntsDataModel, Table>;
    take(n: number): PromiseEnts<EntsDataModel, Table>;
    first(): PromiseEntOrNull<EntsDataModel, Table>;
    firstX(): PromiseEnt<EntsDataModel, Table>;
    unique(): PromiseEntOrNull<EntsDataModel, Table>;
    uniqueX(): PromiseEnt<EntsDataModel, Table>;
}
interface PromiseQuery<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends PromiseOrderedQuery<EntsDataModel, Table> {
    order(order: "asc" | "desc"): PromiseOrderedQuery<EntsDataModel, Table>;
}
interface PromisePaginationResultOrNull<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends Promise<PaginationResult<Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>> | null> {
    docs(): Promise<PaginationResult<DocumentByName<EntsDataModel, Table>> | null>;
    map<TOutput>(callbackFn: (value: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>, index: number, array: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]) => Promise<TOutput> | TOutput): Promise<PaginationResult<TOutput> | null>;
}
interface PromisePaginationResult<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends Promise<PaginationResult<Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>>> {
    docs(): Promise<PaginationResult<DocumentByName<EntsDataModel, Table>>>;
    map<TOutput>(callbackFn: (value: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>, index: number, array: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]) => Promise<TOutput> | TOutput): Promise<PaginationResult<TOutput>>;
}
interface PromiseEntsOrNull<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends Promise<Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[] | null> {
    map<TOutput>(callbackFn: (value: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>, index: number, array: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]) => Promise<TOutput> | TOutput): PromiseArrayOrNull<TOutput>;
    docs(): Promise<DocumentByName<EntsDataModel, Table>[] | null>;
}
interface PromiseEntsWriterOrNull<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends Promise<EntWriter<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[] | null> {
    map<TOutput>(callbackFn: (value: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>, index: number, array: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]) => Promise<TOutput> | TOutput): PromiseArrayOrNull<TOutput>;
    docs(): Promise<DocumentByName<EntsDataModel, Table>[] | null>;
}
interface PromiseEnts<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends Promise<Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]> {
    map<TOutput>(callbackFn: (value: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>, index: number, array: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]) => Promise<TOutput> | TOutput): PromiseArray<TOutput>;
    docs(): Promise<DocumentByName<EntsDataModel, Table>[]>;
}
interface PromiseEntsOrNulls<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends Promise<(Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel> | null)[]> {
}
interface PromiseEdgeOrderedEntsOrNull<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends PromiseEntsOrNull<EntsDataModel, Table> {
    /**
     * Paginate the ents on the other end of the edge.
     * Results are ordered by edge's `_creationTime`.
     */
    paginate(paginationOpts: PaginationOptions): PromisePaginationResultOrNull<EntsDataModel, Table>;
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
interface PromiseEdgeEntsOrNull<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends PromiseEdgeOrderedEntsOrNull<EntsDataModel, Table> {
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
    order(order: "asc" | "desc", indexName?: IndexNames<NamedTableInfo<EntsDataModel, Table>>): PromiseEdgeOrderedEntsOrNull<EntsDataModel, Table>;
}
interface PromiseEdgeOrderedEntsWriterOrNull<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends PromiseEntsWriterOrNull<EntsDataModel, Table> {
    /**
     * Paginate the ents on the other end of the edge.
     * Results are ordered by edge's `_creationTime`.
     */
    paginate(paginationOpts: PaginationOptions): PromisePaginationResultWriterOrNull<EntsDataModel, Table>;
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
interface PromiseEdgeEntsWriterOrNull<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends PromiseEdgeOrderedEntsWriterOrNull<EntsDataModel, Table> {
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
    order(order: "asc" | "desc", indexName?: IndexNames<NamedTableInfo<EntsDataModel, Table>>): PromiseEdgeOrderedEntsWriterOrNull<EntsDataModel, Table>;
}
interface PromiseEdgeOrderedEnts<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends PromiseEnts<EntsDataModel, Table> {
    /**
     * Paginate the ents on the other end of the edge.
     * Results are ordered by edge's `_creationTime`.
     */
    paginate(paginationOpts: PaginationOptions): PromisePaginationResult<EntsDataModel, Table>;
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
interface PromiseEdgeEnts<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends PromiseEdgeOrderedEnts<EntsDataModel, Table> {
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
    order(order: "asc" | "desc", indexName?: IndexNames<NamedTableInfo<EntsDataModel, Table>>): PromiseEdgeOrderedEnts<EntsDataModel, Table>;
}
interface PromiseEdgeOrderedEntsWriter<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends PromiseEntsWriter<EntsDataModel, Table> {
    /**
     * Paginate the ents on the other end of the edge.
     * Results are ordered by edge's `_creationTime`.
     */
    paginate(paginationOpts: PaginationOptions): PromisePaginationResultWriter<EntsDataModel, Table>;
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
interface PromiseEdgeEntsWriter<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends PromiseEdgeOrderedEntsWriter<EntsDataModel, Table> {
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
    order(order: "asc" | "desc", indexName?: IndexNames<NamedTableInfo<EntsDataModel, Table>>): PromiseEdgeOrderedEntsWriter<EntsDataModel, Table>;
}
interface PromiseEntOrNull<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends Promise<Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel> | null> {
    edge<Edge extends keyof EntsDataModel[Table]["edges"]>(edge: Edge): PromiseEdgeOrNull<EntsDataModel, Table, Edge>;
    doc(): Promise<DocumentByName<EntsDataModel, Table> | null>;
}
interface PromiseEnt<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends Promise<Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>> {
    edge<Edge extends keyof EntsDataModel[Table]["edges"]>(edge: Edge): PromiseEdge<EntsDataModel, Table, Edge>;
    edgeX<Edge extends keyof EntsDataModel[Table]["edges"]>(edge: Edge): PromiseEdgeOrThrow<EntsDataModel, Table, Edge>;
    doc(): Promise<DocumentByName<EntsDataModel, Table>>;
}
interface PromiseArrayOrNull<T> extends Promise<T[] | null> {
    filter<S extends T>(predicate: (value: T, index: number, array: T[] | null) => value is S): Promise<S[] | null>;
    filter(predicate: (value: T, index: number, array: T[] | null) => unknown): Promise<T[] | null>;
}
interface PromiseArray<T> extends Promise<T[]> {
    filter<S extends T>(predicate: (value: T, index: number, array: T[]) => value is S): Promise<S[]>;
    filter(predicate: (value: T, index: number, array: T[]) => unknown): Promise<T[]>;
}
declare function entWrapper<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>>(fields: DocumentByName<EntsDataModel, Table>, ctx: EntQueryCtx<EntsDataModel>, entDefinitions: EntsDataModel, table: Table): Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>;
declare function entsTableFactory<Ctx extends EntQueryCtx<any>, EntsDataModel extends GenericEntsDataModel>(ctx: Ctx, entDefinitions: EntsDataModel, options?: {
    scheduledDelete?: ScheduledDeleteFuncRef;
}): Ctx extends EntMutationCtx<any> ? EntsTableWriter<EntsDataModel> : EntsTable<EntsDataModel>;
type EntsTableReader<EntsDataModel extends GenericEntsDataModel> = {
    <Table extends TableNamesInDataModel<EntsDataModel>, IndexName extends IndexNames<NamedTableInfo<EntsDataModel, Table>>>(table: Table, indexName: IndexName, indexRange?: (q: IndexRangeBuilder<DocumentByName<EntsDataModel, Table>, NamedIndex<NamedTableInfo<EntsDataModel, Table>, IndexName>>) => IndexRange): PromiseQuery<EntsDataModel, Table>;
    <Table extends TableNamesInDataModel<EntsDataModel>>(table: Table): PromiseTable<EntsDataModel, Table>;
};
type EntsTable<EntsDataModel extends GenericEntsDataModel> = EntsTableReader<EntsDataModel> & {
    system: EntsTableReader<EntsSystemDataModel>;
};
type EntsTableWriter<EntsDataModel extends GenericEntsDataModel> = {
    <Table extends TableNamesInDataModel<EntsDataModel>, IndexName extends IndexNames<NamedTableInfo<EntsDataModel, Table>>>(table: Table, indexName: IndexName, indexRange?: (q: IndexRangeBuilder<DocumentByName<EntsDataModel, Table>, NamedIndex<NamedTableInfo<EntsDataModel, Table>, IndexName>>) => IndexRange): PromiseQueryWriter<EntsDataModel, Table>;
    <Table extends TableNamesInDataModel<EntsDataModel>>(table: Table): PromiseTableWriter<Table, EntsDataModel>;
    system: EntsTableReader<EntsSystemDataModel>;
};
declare class EntInstance<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> {
    edge<Edge extends keyof EntsDataModel[Table]["edges"]>(edge: Edge): PromiseEdge<EntsDataModel, Table, Edge>;
    edgeX<Edge extends keyof EntsDataModel[Table]["edges"]>(edge: Edge): PromiseEdgeOrThrow<EntsDataModel, Table, Edge>;
    doc(): DocumentByName<EntsDataModel, Table>;
}
type Ent<Table extends TableNamesInDataModel<EntsDataModel>, Doc extends DocumentByName<EntsDataModel, Table>, EntsDataModel extends GenericEntsDataModel> = Doc & EntInstance<EntsDataModel, Table>;
type GenericEnt<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> = Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>;
type PromiseEdge<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>, Edge extends keyof EntsDataModel[Table]["edges"], Config extends GenericEdgeConfig = EntsDataModel[Table]["edges"][Edge], ToTable extends TableNamesInDataModel<EntsDataModel> = EntsDataModel[Table]["edges"][Edge]["to"]> = PromiseEdgeResult<Config, PromiseEdgeEnts<EntsDataModel, ToTable>, PromiseQuery<EntsDataModel, ToTable>, ToTable extends "_storage" | "_scheduled_functions" ? PromiseEntOrNull<EntsSystemDataModel, ToTable> : PromiseEntOrNull<EntsDataModel, ToTable>, ToTable extends "_storage" ? PromiseEnt<EntsSystemDataModel, ToTable> : ToTable extends "_scheduled_functions" ? PromiseEntOrNull<EntsSystemDataModel, ToTable> : PromiseEnt<EntsDataModel, ToTable>>;
type PromiseEdgeOrThrow<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>, Edge extends keyof EntsDataModel[Table]["edges"], Config extends GenericEdgeConfig = EntsDataModel[Table]["edges"][Edge], ToTable extends TableNamesInDataModel<EntsDataModel> = EntsDataModel[Table]["edges"][Edge]["to"]> = PromiseEdgeResult<Config, PromiseEdgeEnts<EntsDataModel, ToTable>, PromiseQuery<EntsDataModel, ToTable>, PromiseEnt<EntsDataModel, ToTable>, PromiseEnt<EntsDataModel, ToTable>>;
type PromiseEdgeOrNull<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>, Edge extends keyof EntsDataModel[Table]["edges"], Config extends GenericEdgeConfig = EntsDataModel[Table]["edges"][Edge], ToTable extends TableNamesInDataModel<EntsDataModel> = EntsDataModel[Table]["edges"][Edge]["to"]> = PromiseEdgeResult<Config, PromiseEdgeEntsOrNull<EntsDataModel, ToTable>, PromiseQueryOrNull<EntsDataModel, ToTable>, PromiseEntOrNull<EntsDataModel, ToTable>, PromiseEntOrNull<EntsDataModel, ToTable>>;
type PromiseEdgeWriter<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>, Edge extends keyof EntsDataModel[Table]["edges"], Config extends GenericEdgeConfig = EntsDataModel[Table]["edges"][Edge], ToTable extends TableNamesInDataModel<EntsDataModel> = EntsDataModel[Table]["edges"][Edge]["to"]> = PromiseEdgeResult<Config, PromiseEdgeEntsWriter<EntsDataModel, ToTable>, PromiseQueryWriter<EntsDataModel, ToTable>, PromiseEntWriterOrNull<EntsDataModel, ToTable>, PromiseEntWriter<EntsDataModel, ToTable>>;
type PromiseEdgeWriterOrThrow<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>, Edge extends keyof EntsDataModel[Table]["edges"], Config extends GenericEdgeConfig = EntsDataModel[Table]["edges"][Edge], ToTable extends TableNamesInDataModel<EntsDataModel> = EntsDataModel[Table]["edges"][Edge]["to"]> = PromiseEdgeResult<Config, PromiseEdgeEntsWriter<EntsDataModel, ToTable>, PromiseQueryWriter<EntsDataModel, ToTable>, PromiseEntWriter<EntsDataModel, ToTable>, PromiseEntWriter<EntsDataModel, ToTable>>;
type PromiseEdgeWriterOrNull<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>, Edge extends keyof EntsDataModel[Table]["edges"], Config extends GenericEdgeConfig = EntsDataModel[Table]["edges"][Edge], ToTable extends TableNamesInDataModel<EntsDataModel> = EntsDataModel[Table]["edges"][Edge]["to"]> = PromiseEdgeResult<Config, PromiseEdgeEntsWriterOrNull<EntsDataModel, ToTable>, PromiseQueryWriterOrNull<EntsDataModel, ToTable>, PromiseEntWriterOrNull<EntsDataModel, ToTable>, PromiseEntWriterOrNull<EntsDataModel, ToTable>>;
interface PromiseOrderedQueryWriter<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends Promise<EntWriter<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]>, PromiseOrderedQueryBase<EntsDataModel, Table> {
    paginate(paginationOpts: PaginationOptions): PromisePaginationResultWriter<EntsDataModel, Table>;
    map<TOutput>(callbackFn: (value: EntWriter<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>, index: number, array: EntWriter<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]) => Promise<TOutput> | TOutput): PromiseArray<TOutput>;
    take(n: number): PromiseEntsWriter<EntsDataModel, Table>;
    first(): PromiseEntWriterOrNull<EntsDataModel, Table>;
    firstX(): PromiseEntWriter<EntsDataModel, Table>;
    unique(): PromiseEntWriterOrNull<EntsDataModel, Table>;
    uniqueX(): PromiseEntWriter<EntsDataModel, Table>;
}
interface PromiseQueryWriter<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends PromiseOrderedQueryWriter<EntsDataModel, Table> {
    order(order: "asc" | "desc"): PromiseOrderedQueryWriter<EntsDataModel, Table>;
}
interface PromiseEntsWriter<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends PromiseEnts<EntsDataModel, Table> {
    firstX(): PromiseEntWriter<EntsDataModel, Table>;
    uniqueX(): PromiseEntWriter<EntsDataModel, Table>;
}
interface PromisePaginationResultWriterOrNull<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends Promise<PaginationResult<EntWriter<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>> | null> {
    docs(): Promise<PaginationResult<DocumentByName<EntsDataModel, Table>> | null>;
    map<TOutput>(callbackFn: (value: EntWriter<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>, index: number, array: EntWriter<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]) => Promise<TOutput> | TOutput): Promise<PaginationResult<TOutput> | null>;
}
interface PromisePaginationResultWriter<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends Promise<PaginationResult<EntWriter<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>>> {
    docs(): Promise<PaginationResult<DocumentByName<EntsDataModel, Table>>>;
    map<TOutput>(callbackFn: (value: EntWriter<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>, index: number, array: EntWriter<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>[]) => Promise<TOutput> | TOutput): Promise<PaginationResult<TOutput>>;
}
interface PromiseTableWriter<Table extends TableNamesInDataModel<EntsDataModel>, EntsDataModel extends GenericEntsDataModel> extends PromiseQueryWriter<EntsDataModel, Table>, PromiseTableBase<EntsDataModel, Table> {
    get<Indexes extends EntsDataModel[Table]["indexes"], Index extends keyof Indexes>(indexName: Index, ...values: IndexFieldTypesForEq<EntsDataModel, Table, Indexes[Index]>): PromiseEntWriterOrNull<EntsDataModel, Table>;
    get(id: GenericId<Table>): PromiseEntWriterOrNull<EntsDataModel, Table>;
    /**
     * Fetch a unique document from the DB using given index, throw if it doesn't exist.
     */
    getX<Indexes extends EntsDataModel[Table]["indexes"], Index extends keyof Indexes>(indexName: Index, ...values: IndexFieldTypesForEq<EntsDataModel, Table, Indexes[Index]>): PromiseEntWriter<EntsDataModel, Table>;
    /**
     * Fetch a document from the DB for a given ID, throw if it doesn't exist.
     */
    getX(id: GenericId<Table>): PromiseEntWriter<EntsDataModel, Table>;
    /**
     * Return all documents in the table in given order.
     * Sort either by given index or by _creationTime.
     */
    order(order: "asc" | "desc", indexName?: IndexNames<NamedTableInfo<EntsDataModel, Table>>): PromiseOrderedQueryWriter<EntsDataModel, Table>;
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
    search<IndexName extends SearchIndexNames<NamedTableInfo<EntsDataModel, Table>>>(indexName: IndexName, searchFilter: (q: SearchFilterBuilder<DocumentByName<EntsDataModel, Table>, NamedSearchIndex<NamedTableInfo<EntsDataModel, Table>, IndexName>>) => SearchFilter): PromiseOrderedQueryWriter<EntsDataModel, Table>;
    /**
     * Insert a new document into a table.
     *
     * @param table - The name of the table to insert a new document into.
     * @param value - The {@link Value} to insert into the given table.
     * @returns - {@link GenericId} of the new document.
     */
    insert(value: Expand<WithoutSystemFields<WithEdgeInserts<DocumentByName<EntsDataModel, Table>, EntsDataModel[Table]["edges"]>>>): PromiseEntId<EntsDataModel, Table>;
    /**
     * Insert new documents into a table.
     *
     * @param table - The name of the table to insert a new document into.
     * @param value - The {@link Value} to insert into the given table.
     * @returns - {@link GenericId} of the new document.
     */
    insertMany(values: Expand<WithoutSystemFields<WithEdgeInserts<DocumentByName<EntsDataModel, Table>, EntsDataModel[Table]["edges"]>>>[]): Promise<GenericId<Table>[]>;
}
interface PromiseEntWriterOrNull<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends Promise<EntWriter<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel> | null> {
    edge<Edge extends keyof EntsDataModel[Table]["edges"]>(edge: Edge): PromiseEdgeWriterOrNull<EntsDataModel, Table, Edge>;
    doc(): Promise<DocumentByName<EntsDataModel, Table> | null>;
}
interface PromiseEntWriter<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends Promise<EntWriter<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>> {
    edge<Edge extends keyof EntsDataModel[Table]["edges"]>(edge: Edge): PromiseEdgeWriter<EntsDataModel, Table, Edge>;
    edgeX<Edge extends keyof EntsDataModel[Table]["edges"]>(edge: Edge): PromiseEdgeWriterOrThrow<EntsDataModel, Table, Edge>;
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
    patch(value: Partial<Expand<WithEdgePatches<DocumentByName<EntsDataModel, Table>, EntsDataModel[Table]["edges"]>>>): PromiseEntId<EntsDataModel, Table>;
    /**
     * Replace the value of an existing document, overwriting its old value.
     *
     * @param value - The new {@link GenericDocument} for the document. This value can omit the system fields,
     * and the database will preserve them in.
     */
    replace(value: Expand<WithOptionalSystemFields<WithEdges<DocumentByName<EntsDataModel, Table>, EntsDataModel[Table]["edges"]>>>): PromiseEntId<EntsDataModel, Table>;
    /**
     * Delete this existing document.
     *
     * @param id - The {@link GenericId} of the document to remove.
     */
    delete(): Promise<GenericId<Table>>;
}
declare class EntWriterInstance<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends EntInstance<EntsDataModel, Table> {
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
    patch(value: Partial<WithEdgePatches<DocumentByName<EntsDataModel, Table>, EntsDataModel[Table]["edges"]>>): PromiseEntId<EntsDataModel, Table>;
    /**
     * Replace the value of this existing document, overwriting its old value.
     *
     * @param value - The new {@link GenericDocument} for the document. This value can omit the system fields,
     * and the database will preserve them in.
     */
    replace(value: WithOptionalSystemFields<WithEdges<DocumentByName<EntsDataModel, Table>, EntsDataModel[Table]["edges"]>>): PromiseEntId<EntsDataModel, Table>;
    /**
     * Delete this existing document.
     *
     * @param id - The {@link GenericId} of the document to remove.
     */
    delete(): Promise<GenericId<Table>>;
}
type EntWriter<Table extends TableNamesInDataModel<EntsDataModel>, Doc extends DocumentByName<EntsDataModel, Table>, EntsDataModel extends GenericEntsDataModel> = Doc & EntWriterInstance<EntsDataModel, Table>;
type GenericEntWriter<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> = EntWriter<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>;
interface PromiseEntId<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>> extends Promise<GenericId<Table>> {
    get(): PromiseEntWriter<EntsDataModel, Table>;
}
interface EntQueryCtx<DataModel extends GenericDataModel> {
    db: GenericDatabaseReader<DataModel>;
    vectorSearch?: undefined;
}
interface EntMutationCtx<DataModel extends GenericDataModel> extends EntQueryCtx<DataModel> {
    db: GenericDatabaseWriter<DataModel>;
    storage: StorageWriter;
    scheduler: Scheduler;
}
type DocRetriever<ID, Doc> = () => Promise<{
    id: ID;
    doc: () => Promise<Doc>;
}>;
declare function addEntRules<EntsDataModel extends GenericEntsDataModel>(entDefinitions: EntsDataModel, rules: {
    [Table in keyof EntsDataModel]?: Table extends TableNamesInDataModel<EntsDataModel> ? {
        read?: (ent: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>) => Promise<boolean>;
        write?: (args: {
            operation: "create";
            ent: undefined;
            value: WithoutSystemFields<DocumentByName<EntsDataModel, Table>>;
        } | {
            operation: "update";
            ent: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>;
            value: Partial<WithoutSystemFields<DocumentByName<EntsDataModel, Table>>>;
        } | {
            operation: "delete";
            ent: Ent<Table, DocumentByName<EntsDataModel, Table>, EntsDataModel>;
            value: undefined;
        }) => Promise<boolean>;
    } : never;
}): EntsDataModel;
declare function getReadRule(entDefinitions: GenericEntsDataModel, table: string): ((doc: GenericDocument) => Promise<boolean>) | undefined;
declare function getWriteRule(entDefinitions: GenericEntsDataModel, table: string): ((args: {
    operation: "create";
    ent: undefined;
    value: WithoutSystemFields<GenericDocument>;
} | {
    operation: "update";
    ent: Ent<any, GenericDocument, any>;
    value: Partial<WithoutSystemFields<GenericDocument>>;
} | {
    operation: "delete";
    ent: Ent<any, GenericDocument, any>;
    value: undefined;
}) => Promise<boolean>) | undefined;
declare function getDeletionConfig<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>>(entDefinitions: EntsDataModel, table: Table): DeletionConfig | undefined;

export { type PromiseEntId as $, type PromiseEntOrNull as A, type PromiseEnt as B, type PromiseArrayOrNull as C, type PromiseArray as D, type EdgeChanges as E, entWrapper as F, entsTableFactory as G, type EntsTable as H, type EntsTableWriter as I, type Ent as J, type GenericEnt as K, type PromiseEdge as L, type PromiseEdgeOrThrow as M, type PromiseEdgeWriter as N, type PromiseEdgeWriterOrThrow as O, type PromiseOrderedQueryOrNull as P, type PromiseEdgeWriterOrNull as Q, type PromiseOrderedQueryWriter as R, type PromiseQueryWriter as S, type PromiseEntsWriter as T, type PromisePaginationResultWriterOrNull as U, type PromisePaginationResultWriter as V, WriterImplBase as W, type PromiseTableWriter as X, type PromiseEntWriterOrNull as Y, type PromiseEntWriter as Z, type GenericEntWriter as _, type WithEdgeInserts as a, type EntQueryCtx as a0, type EntMutationCtx as a1, type DocRetriever as a2, addEntRules as a3, getReadRule as a4, getWriteRule as a5, getDeletionConfig as a6, type WithEdges as b, type WithEdgePatches as c, type PromiseOrderedQueryWriterOrNull as d, type PromiseQueryOrNull as e, type PromiseQueryWriterOrNull as f, type PromiseTableBase as g, type PromiseTable as h, isSystemTable as i, type PromiseOrderedQueryBase as j, type PromiseOrderedQuery as k, type PromiseQuery as l, type PromisePaginationResultOrNull as m, type PromisePaginationResult as n, type PromiseEntsOrNull as o, type PromiseEntsWriterOrNull as p, type PromiseEnts as q, type PromiseEntsOrNulls as r, type PromiseEdgeOrderedEntsOrNull as s, type PromiseEdgeEntsOrNull as t, type PromiseEdgeOrderedEntsWriterOrNull as u, type PromiseEdgeEntsWriterOrNull as v, type PromiseEdgeOrderedEnts as w, type PromiseEdgeEnts as x, type PromiseEdgeOrderedEntsWriter as y, type PromiseEdgeEntsWriter as z };
