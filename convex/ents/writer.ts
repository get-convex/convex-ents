import {
  DocumentByName,
  GenericDataModel,
  GenericDocument,
  GenericMutationCtx,
  TableNamesInDataModel,
  WithOptionalSystemFields,
  WithoutSystemFields,
} from "convex/server";
import { PromiseTable, PromiseTableImpl } from "./functions";
import { EdgeConfig, GenericEdgeConfig, GenericEntsDataModel } from "./schema";
import { GenericId } from "convex/values";

export interface TableWriter<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends PromiseTable<DataModel, EntsDataModel, Table> {
  /**
   * Insert a new document into a table.
   *
   * @param table - The name of the table to insert a new document into.
   * @param value - The {@link values.Value} to insert into the given table.
   * @returns - {@link values.GenericId} of the new document.
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
  ): Promise<GenericId<Table>>;

  /**
   * Patch an existing document, shallow merging it with the given partial
   * document.
   *
   * New fields are added. Existing fields are overwritten. Fields set to
   * `undefined` are removed.
   *
   * @param id - The {@link GenericId} of the document to patch.
   * @param value - The partial {@link GenericDocument} to merge into the specified document. If this new value
   * specifies system fields like `_id`, they must match the document's existing field values.
   */
  patch(
    id: GenericId<Table>,
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
   * @param id - The {@link GenericId} of the document to replace.
   * @param value - The new {@link GenericDocument} for the document. This value can omit the system fields,
   * and the database will fill them in.
   */
  replace(
    id: GenericId<Table>,
    value: WithOptionalSystemFields<
      WithEdges<
        DataModel,
        DocumentByName<DataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >
  ): Promise<void>;

  /**
   * Delete an existing document.
   *
   * @param id - The {@link GenericId} of the document to remove.
   */
  delete(id: GenericId<TableNamesInDataModel<DataModel>>): Promise<void>;
}

export class TableWriterImpl<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends PromiseTableImpl<DataModel, EntsDataModel, Table> {
  protected ctx: GenericMutationCtx<DataModel>;

  constructor(
    ctx: GenericMutationCtx<DataModel>,
    entDefinitions: EntsDataModel,
    table: Table
  ) {
    super(ctx, entDefinitions, table);
    this.ctx = ctx;
  }

  async insert(
    value: WithoutSystemFields<
      WithEdges<
        DataModel,
        DocumentByName<DataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >
  ) {
    await this.checkUniqueness(value);
    const fields = this.fieldsOnly(value as any);
    const docId = await this.ctx.db.insert(this.table, fields as any);
    const edges: EdgeChanges = {};
    Object.keys(value).forEach((key) => {
      const edgeDefinition: EdgeConfig | undefined = (
        this.entDefinitions[this.table].edges as any
      ).filter(({ name }: EdgeConfig) => name === key)[0];
      if (
        edgeDefinition === undefined ||
        (edgeDefinition.cardinality === "single" &&
          edgeDefinition.type === "field")
      ) {
        return;
      }
      edges[key] = { add: value[key] };
    });
    await this.writeEdges(docId, edges);
    return docId;
  }

  /**
   * Patch an existing document, shallow merging it with the given partial
   * document.
   *
   * New fields are added. Existing fields are overwritten. Fields set to
   * `undefined` are removed.
   *
   * @param id - The {@link GenericId} of the document to patch.
   * @param value - The partial {@link GenericDocument} to merge into the specified document. If this new value
   * specifies system fields like `_id`, they must match the document's existing field values.
   */
  async patch(
    id: GenericId<Table>,
    value: Partial<
      WithEdgePatches<
        DataModel,
        DocumentByName<DataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >
  ) {
    await this.checkUniqueness(value, id);
    const fields = this.fieldsOnly(value);
    const docId = this.normalizeIdX(id);
    await this.ctx.db.patch(this.normalizeIdX(id), fields);

    const edges: EdgeChanges = {};
    await Promise.all(
      Object.keys(value).map(async (key) => {
        const edgeDefinition: EdgeConfig | undefined = (
          this.entDefinitions[this.table].edges as any
        ).filter(({ name }: EdgeConfig) => name === key)[0];
        if (
          edgeDefinition === undefined ||
          (edgeDefinition.cardinality === "single" &&
            edgeDefinition.type === "field")
        ) {
          return;
        }
        if (edgeDefinition.cardinality === "single") {
          const existing = await this.ctx.db
            .query(edgeDefinition.to)
            .withIndex(edgeDefinition.ref, (q) =>
              q.eq(edgeDefinition.ref, docId as any)
            )
            .unique();

          edges[key] = {
            add: value[key] as GenericId<any>,
            remove: existing?._id as GenericId<any> | undefined,
          };
        } else {
          edges[key] = value[key] as any;
        }
      })
    );
    await this.writeEdges(docId, edges);
  }

  /**
   * Replace the value of an existing document, overwriting its old value.
   *
   * @param id - The {@link GenericId} of the document to replace.
   * @param value - The new {@link GenericDocument} for the document. This value can omit the system fields,
   * and the database will fill them in.
   */
  async replace(
    id: GenericId<Table>,
    value: WithOptionalSystemFields<
      WithEdges<
        DataModel,
        DocumentByName<DataModel, Table>,
        EntsDataModel[Table]["edges"]
      >
    >
  ) {
    await this.checkUniqueness(value, id);
    const fields = this.fieldsOnly(value as any);
    const docId = this.normalizeIdX(id);
    await this.ctx.db.replace(docId, fields as any);

    const edges: EdgeChanges = {};

    await Promise.all(
      (this.entDefinitions[this.table].edges as unknown as EdgeConfig[]).map(
        async (edgeDefinition) => {
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
                edges[key] = {
                  add: idOrIds as GenericId<any>,
                  remove: oldDoc[key] as GenericId<any> | undefined,
                };
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
              const existing = (
                await this.ctx.db
                  .query(edgeDefinition.table)
                  .withIndex(edgeDefinition.field, (q) =>
                    q.eq(edgeDefinition.field, docId as any)
                  )
                  .collect()
              ).map((doc) => doc._id);
              edges[key] = {
                add: idOrIds as GenericId<any>[],
                remove: existing as GenericId<any>[],
              };
            }
          }
        }
      )
    );
    await this.writeEdges(docId, edges);
  }

  /**
   * Delete an existing document.
   *
   * @param id - The {@link GenericId} of the document to remove.
   */
  delete(id: GenericId<TableNamesInDataModel<DataModel>>) {
    return this.ctx.db.delete(this.normalizeIdX(id));
  }

  async checkUniqueness(value: Partial<GenericDocument>, id?: GenericId<any>) {
    await Promise.all(
      (this.entDefinitions[this.table].edges as unknown as EdgeConfig[]).map(
        async (edgeDefinition) => {
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
            if (
              existing !== null &&
              (id === undefined || existing._id !== id)
            ) {
              throw new Error(
                `In table "${this.table}" cannot create a duplicate 1:1 edge "${
                  edgeDefinition.name
                }" to ID "${
                  value[key] as string
                }", existing document with ID "${
                  existing._id as string
                }" already has it.`
              );
            }
          }
        }
      )
    );
  }

  async writeEdges(docId: GenericId<any>, changes: EdgeChanges) {
    await Promise.all(
      (this.entDefinitions[this.table].edges as unknown as EdgeConfig[]).map(
        async (edgeDefinition) => {
          const idOrIds = changes[edgeDefinition.name];
          if (idOrIds === undefined) {
            return;
          }
          if (edgeDefinition.cardinality === "single") {
            if (edgeDefinition.type === "ref") {
              if (idOrIds.remove !== undefined) {
                await this.ctx.db.patch(
                  idOrIds.remove as GenericId<any>,
                  { [edgeDefinition.ref]: undefined } as any
                );
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
                await Promise.all(
                  (idOrIds.remove as GenericId<any>[]).map((id) =>
                    this.ctx.db.patch(id, {
                      [edgeDefinition.ref]: undefined,
                    } as any)
                  )
                );
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
              if (idOrIds.remove !== undefined) {
                await Promise.all(
                  (idOrIds.remove as GenericId<any>[]).map((id) =>
                    this.ctx.db.delete(id)
                  )
                );
              }
              if (idOrIds.add !== undefined) {
                await Promise.all(
                  (idOrIds.add as GenericId<any>[]).map(async (id) =>
                    this.ctx.db.insert(edgeDefinition.table, {
                      [edgeDefinition.field]: docId,
                      [edgeDefinition.ref]: id,
                    } as any)
                  )
                );
              }
            }
          }
        }
      )
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
        this.entDefinitions[this.table].edges as any
      ).filter(({ name }: EdgeConfig) => name === key)[0];
      if (
        edgeDefinition === undefined ||
        (edgeDefinition.cardinality === "single" &&
          edgeDefinition.type === "field")
      ) {
        fields[key] = value[key]!;
      }
    });
    return fields;
  }
}

type WithEdges<
  DataModel extends GenericDataModel,
  Document extends GenericDocument,
  Edges extends Record<string, GenericEdgeConfig<DataModel>>
> = Document & {
  [key in keyof Edges]?: Edges[key]["cardinality"] extends "single"
    ? GenericId<Edges[key]["to"]>
    : GenericId<Edges[key]["to"]>[];
};

type WithEdgePatches<
  DataModel extends GenericDataModel,
  Document extends GenericDocument,
  Edges extends Record<string, GenericEdgeConfig<DataModel>>
> = Document & {
  [key in keyof Edges]?: Edges[key]["cardinality"] extends "single"
    ? GenericId<Edges[key]["to"]>
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
  }
>;
