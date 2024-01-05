import {
  DocumentByName,
  GenericDataModel,
  GenericDatabaseWriter,
  GenericDocument,
  GenericMutationCtx,
  TableNamesInDataModel,
  WithOptionalSystemFields,
  WithoutSystemFields,
} from "convex/server";
import { GenericId } from "convex/values";
import {
  EntByName,
  PromiseEdge,
  PromiseEdgeOrThrow,
  PromiseEntOrNullImpl,
  PromiseTable,
  PromiseTableImpl,
} from "./functions";
import {
  EdgeConfig,
  Expand,
  FieldConfig,
  GenericEdgeConfig,
  GenericEntsDataModel,
} from "./schema";

export interface PromiseTableWriter<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends PromiseTable<DataModel, EntsDataModel, Table> {
  /**
   * Fetch a document from the DB for a given ID, throw if it doesn't exist.
   */
  getX(id: GenericId<Table>): PromiseEntWriter<DataModel, EntsDataModel, Table>;

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

export class PromiseTableWriterImpl<
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
      async (db) => {
        await this.base.checkUniqueness(value);
        const fields = this.base.fieldsOnly(value as any);
        const docId = await db.insert(this.table, fields as any);
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
> extends Promise<EntWriterByName<DataModel, EntsDataModel, Table>> {
  then<
    TResult1 = EntWriterByName<DataModel, EntsDataModel, Table>,
    TResult2 = never
  >(
    onfulfilled?:
      | ((
          value: EntWriterByName<DataModel, EntsDataModel, Table>
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
  ): Promise<void>;

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
  ): Promise<void>;

  /**
   * Delete this existing document.
   *
   * @param id - The {@link GenericId} of the document to remove.
   */
  delete(): Promise<GenericId<Table>>;
}

export class PromiseEntWriterImpl<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends PromiseEntOrNullImpl<DataModel, EntsDataModel, Table> {
  private base: WriterImplBase<DataModel, EntsDataModel, Table>;

  constructor(
    protected ctx: GenericMutationCtx<DataModel>,
    protected entDefinitions: EntsDataModel,
    protected table: Table,
    protected retrieveId: (db: GenericDatabaseWriter<DataModel>) => Promise<{
      id: GenericId<Table>;
      doc: () => Promise<DocumentByName<DataModel, Table>>;
    }>
  ) {
    super(ctx, entDefinitions, table, async () => {
      const { doc } = await this.retrieveId(this.ctx.db);
      return doc();
    });
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
        const { id } = await this.retrieveId(this.ctx.db);
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
        const { id: docId } = await this.retrieveId(this.ctx.db);
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
    const { id } = await this.retrieveId(this.ctx.db);
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

type WithEdges<
  DataModel extends GenericDataModel,
  Document extends GenericDocument,
  Edges extends Record<string, GenericEdgeConfig<DataModel>>
> = Document & {
  [key in keyof Edges]?: Edges[key]["cardinality"] extends "single"
    ? Edges[key]["type"] extends "ref"
      ? never
      : GenericId<Edges[key]["to"]>
    : GenericId<Edges[key]["to"]>[];
};

type WithEdgePatches<
  DataModel extends GenericDataModel,
  Document extends GenericDocument,
  Edges extends Record<string, GenericEdgeConfig<DataModel>>
> = Document & {
  [key in keyof Edges]?: Edges[key]["cardinality"] extends "single"
    ? Edges[key]["type"] extends "ref"
      ? never
      : GenericId<Edges[key]["to"]>
    : {
        add?: GenericId<Edges[key]["to"]>[];
        remove?: GenericId<Edges[key]["to"]>[];
      };
};

type EdgeChanges = Record<
  string,
  {
    add?: GenericId<any>[] | GenericId<any>;
    remove?: GenericId<any>[] | GenericId<any>;
    removeEdges?: GenericId<any>[];
  }
>;

type EntWriterByName<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> = Expand<
  EntByName<DataModel, EntsDataModel, Table> & {
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
    ): Promise<void>;

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
  }
>;

interface PromiseEntId<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends Promise<GenericId<Table>> {
  get(): PromiseEntWriter<DataModel, EntsDataModel, Table>;

  then<TResult1 = GenericId<Table>, TResult2 = never>(
    onfulfilled?:
      | ((value: GenericId<Table>) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): Promise<TResult1 | TResult2>;
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
    private retrieve: (
      db: GenericDatabaseWriter<DataModel>
    ) => Promise<GenericId<Table>>
  ) {
    super(() => {});
  }

  get() {
    return new PromiseEntOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async (db) => {
        const id = await this.retrieve(this.ctx.db);
        return db.get(id);
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
    return this.retrieve(this.ctx.db).then(onfulfilled, onrejected);
  }
}

class WriterImplBase<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> {
  constructor(
    protected ctx: GenericMutationCtx<DataModel>,
    protected entDefinitions: EntsDataModel,
    protected table: Table
  ) {}

  async writeEdges(docId: GenericId<any>, changes: EdgeChanges) {
    await Promise.all(
      Object.values(
        this.entDefinitions[this.table].edges as Record<string, EdgeConfig>
      ).map(async (edgeDefinition) => {
        const idOrIds = changes[edgeDefinition.name];
        if (idOrIds === undefined) {
          return;
        }
        if (edgeDefinition.cardinality === "single") {
          if (edgeDefinition.type === "ref") {
            if (idOrIds.remove !== undefined) {
              // Cascading delete because 1:1 edges are not optional
              // on the stored field end.
              await this.ctx.db.delete(idOrIds.remove as GenericId<any>);
            }
            if (idOrIds.add !== undefined) {
              await this.ctx.db.patch(
                idOrIds.add as GenericId<any>,
                { [edgeDefinition.ref]: docId } as any
              );
            }
          }
        } else {
          if (edgeDefinition.type === "field") {
            if (idOrIds.remove !== undefined) {
              // Cascading delete because 1:many edges are not optional
              // on the stored field end.
              await Promise.all(
                (idOrIds.remove as GenericId<any>[]).map((id) =>
                  this.ctx.db.delete(id)
                )
              );
              // This would be behavior for optional edge:
              // await Promise.all(
              //   (idOrIds.remove as GenericId<any>[]).map((id) =>
              //     this.ctx.db.patch(id, {
              //       [edgeDefinition.ref]: undefined,
              //     } as any)
              //   )
              // );
            }
            if (idOrIds.add !== undefined) {
              await Promise.all(
                (idOrIds.add as GenericId<any>[]).map(async (id) =>
                  this.ctx.db.patch(id, {
                    [edgeDefinition.ref]: docId,
                  } as any)
                )
              );
            }
          } else {
            let removeEdges: GenericId<any>[] = [];
            if (idOrIds.remove !== undefined) {
              removeEdges = (
                await Promise.all(
                  (idOrIds.remove as GenericId<any>[]).map(async (id) =>
                    (
                      await this.ctx.db
                        .query(edgeDefinition.table)
                        .withIndex(edgeDefinition.field, (q) =>
                          (q.eq(edgeDefinition.field, docId as any) as any).eq(
                            edgeDefinition.ref,
                            id
                          )
                        )
                        .collect()
                    ).concat(
                      edgeDefinition.symmetric
                        ? await this.ctx.db
                            .query(edgeDefinition.table)
                            .withIndex(edgeDefinition.ref, (q) =>
                              (
                                q.eq(edgeDefinition.ref, docId as any) as any
                              ).eq(edgeDefinition.field, id)
                            )
                            .collect()
                        : []
                    )
                  )
                )
              ).map((doc) => (doc as any)._id);
            }
            if (idOrIds.removeEdges !== undefined) {
              removeEdges = idOrIds.removeEdges;
            }
            if (removeEdges.length > 0) {
              await Promise.all(
                removeEdges.map((id) => this.ctx.db.delete(id))
              );
            }

            if (idOrIds.add !== undefined) {
              await Promise.all(
                (idOrIds.add as GenericId<any>[]).map(async (id) => {
                  await this.ctx.db.insert(edgeDefinition.table, {
                    [edgeDefinition.field]: docId,
                    [edgeDefinition.ref]: id,
                  } as any);
                  if (edgeDefinition.symmetric) {
                    await this.ctx.db.insert(edgeDefinition.table, {
                      [edgeDefinition.field]: id,
                      [edgeDefinition.ref]: docId,
                    } as any);
                  }
                })
              );
            }
          }
        }
      })
    );
  }

  async checkUniqueness(value: Partial<GenericDocument>, id?: GenericId<any>) {
    await Promise.all(
      Object.values(
        (this.entDefinitions[this.table] as any).fields as Record<
          string,
          FieldConfig
        >
      ).map(async (fieldDefinition) => {
        if (fieldDefinition.unique) {
          const key = fieldDefinition.name;
          const fieldValue = value[key];
          const existing = await this.ctx.db
            .query(this.table)
            .withIndex(key, (q) => q.eq(key, value[key] as any))
            .unique();
          if (existing !== null && (id === undefined || existing._id !== id)) {
            throw new Error(
              `In table "${
                this.table
              }" cannot create a duplicate document with field "${key}" of value \`${
                fieldValue as string
              }\`, existing document with ID "${
                existing._id as string
              }" already has it.`
            );
          }
        }
      })
    );
    await Promise.all(
      Object.values(
        this.entDefinitions[this.table].edges as Record<string, EdgeConfig>
      ).map(async (edgeDefinition) => {
        if (
          edgeDefinition.cardinality === "single" &&
          edgeDefinition.type === "field" &&
          edgeDefinition.unique
        ) {
          const key = edgeDefinition.field;
          if (value[key] === undefined) {
            return;
          }
          // Enforce uniqueness
          const existing = await this.ctx.db
            .query(this.table)
            .withIndex(key, (q) => q.eq(key, value[key] as any))
            .unique();
          if (existing !== null && (id === undefined || existing._id !== id)) {
            throw new Error(
              `In table "${this.table}" cannot create a duplicate 1:1 edge "${
                edgeDefinition.name
              }" to ID "${value[key] as string}", existing document with ID "${
                existing._id as string
              }" already has it.`
            );
          }
        }
      })
    );
  }

  fieldsOnly(
    value: Partial<
      WithEdgePatches<
        DataModel,
        DocumentByName<DataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >
  ) {
    const fields: GenericDocument = {};
    Object.keys(value).forEach((key) => {
      const edgeDefinition: EdgeConfig | undefined = (
        this.entDefinitions[this.table].edges as EntsDataModel[Table]["edges"]
      )[key] as any;
      if (
        edgeDefinition === undefined
        // This doesn't do anything because the edge name doesn't match the field name
        //  ||
        // (edgeDefinition.cardinality === "single" &&
        //   edgeDefinition.type === "field")
      ) {
        fields[key] = value[key]!;
      }
    });
    return fields;
  }
}
