import {
  DocumentByName,
  GenericDataModel,
  GenericDocument,
  GenericMutationCtx,
  TableNamesInDataModel,
} from "convex/server";
import { GenericId } from "convex/values";
import {
  EdgeConfig,
  FieldConfig,
  GenericEdgeConfig,
  GenericEntsDataModel,
} from "./schema";

export class WriterImplBase<
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
                removeEdges.map(async (id) => {
                  try {
                    await this.ctx.db.delete(id);
                  } catch (e) {
                    // TODO:
                    // For now we're gonna ignore errors here,
                    // because we assume that the only error
                    // is "document not found", which
                    // can be caused by concurrent deletions.
                    // In the future we could track which
                    // edges are being deleted by this mutation,
                    // and skip the call to delete altogether
                  }
                })
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

export type WithEdges<
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

export type WithEdgePatches<
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

export type EdgeChanges = Record<
  string,
  {
    add?: GenericId<any>[] | GenericId<any>;
    remove?: GenericId<any>[] | GenericId<any>;
    removeEdges?: GenericId<any>[];
  }
>;
