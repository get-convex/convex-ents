import {
  DocumentByName,
  GenericDatabaseWriter,
  GenericDocument,
  TableNamesInDataModel,
} from "convex/server";
import { GenericId } from "convex/values";
import { entWrapper, getReadRule, getWriteRule } from "./functions";
import {
  EdgeConfig,
  FieldConfig,
  GenericEdgeConfig,
  GenericEntsDataModel,
} from "./schema";

export class WriterImplBase<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>
> {
  constructor(
    protected db: GenericDatabaseWriter<EntsDataModel>,
    protected entDefinitions: EntsDataModel,
    protected table: Table
  ) {}

  async deleteId(id: GenericId<any>) {
    await this.checkReadAndWriteRule("delete", id, undefined);
    let memoized: GenericDocument | undefined = undefined;
    const oldDoc = async () => {
      if (memoized !== undefined) {
        return memoized;
      }
      return (memoized = (await this.db.get(id))!);
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
              await this.db
                .query(edgeDefinition.to)
                .withIndex(edgeDefinition.ref, (q) =>
                  q.eq(edgeDefinition.ref, id as any)
                )
                .collect()
            ).map((doc) => doc._id);
            edges[key] = { remove: existing as GenericId<any>[] };
          } else {
            const existing = (
              await this.db
                .query(edgeDefinition.table)
                .withIndex(edgeDefinition.field, (q) =>
                  q.eq(edgeDefinition.field, id as any)
                )
                .collect()
            )
              .concat(
                edgeDefinition.symmetric
                  ? await this.db
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
    await this.db.delete(id);
    await this.writeEdges(id, edges);
    return id;
  }

  async deletedIdIn(id: GenericId<any>, table: string) {
    await new WriterImplBase(this.db, this.entDefinitions, table).deleteId(id);
  }

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
              await this.deletedIdIn(
                idOrIds.remove as GenericId<any>,
                edgeDefinition.to
              );
            }
            if (idOrIds.add !== undefined) {
              await this.db.patch(
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
                  this.deletedIdIn(id, edgeDefinition.to)
                )
              );
              // This would be behavior for optional edge:
              // await Promise.all(
              //   (idOrIds.remove as GenericId<any>[]).map((id) =>
              //     this.db.patch(id, {
              //       [edgeDefinition.ref]: undefined,
              //     } as any)
              //   )
              // );
            }
            if (idOrIds.add !== undefined) {
              await Promise.all(
                (idOrIds.add as GenericId<any>[]).map(async (id) =>
                  this.db.patch(id, {
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
                      await this.db
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
                        ? await this.db
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
                    await this.db.delete(id);
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
                  await this.db.insert(edgeDefinition.table, {
                    [edgeDefinition.field]: docId,
                    [edgeDefinition.ref]: id,
                  } as any);
                  if (edgeDefinition.symmetric) {
                    await this.db.insert(edgeDefinition.table, {
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
          const existing = await this.db
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
          const existing = await this.db
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
        DocumentByName<EntsDataModel, Table>,
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

  async checkReadAndWriteRule(
    operation: "create" | "update" | "delete",
    id: GenericId<Table> | undefined,
    value: Partial<GenericDocument> | undefined
  ) {
    if (id !== undefined) {
      const readPolicy = getReadRule(this.entDefinitions, this.table);
      if (readPolicy !== undefined) {
        const doc = await this.db.get(id);
        if (doc === null) {
          throw new Error(
            `Cannot update document with ID "${id}" in table "${this.table} because it does not exist"`
          );
        }
        const decision = await readPolicy(doc);
        if (!decision) {
          throw new Error(
            `Cannot update document with ID "${id}" from table "${this.table}"`
          );
        }
      }
    }
    const writePolicy = getWriteRule(this.entDefinitions, this.table);
    if (writePolicy === undefined) {
      return;
    }
    const ent =
      id === undefined
        ? undefined
        : entWrapper(
            (await this.db.get(id))!,
            this.db,
            this.entDefinitions,
            this.table
          );
    // Replace allows _id and _creationTime, but rules should not
    // rely on them.
    const { _id, _creationTime, ...safeValue } = value ?? {};
    const decision = await writePolicy({
      operation,
      ent: ent as any,
      value: value !== undefined ? (safeValue as any) : undefined,
    });
    if (!decision) {
      if (id === undefined) {
        throw new Error(
          `Cannot insert into table "${this.table}": \`${JSON.stringify(
            value
          )}\``
        );
      } else if (value === undefined) {
        throw new Error(
          `Cannot delete from table "${this.table}" with ID "${id}"`
        );
      } else {
        throw new Error(
          `Cannot update document with ID "${id}" in table "${
            this.table
          }" with: \`${JSON.stringify(value)}\``
        );
      }
    }
  }
}

export type WithEdges<
  Document extends GenericDocument,
  Edges extends Record<string, GenericEdgeConfig>
> = Document & {
  [key in keyof Edges as Edges[key]["cardinality"] extends "single"
    ? never
    : key]?: GenericId<Edges[key]["to"]>[];
};

export type WithEdgePatches<
  Document extends GenericDocument,
  Edges extends Record<string, GenericEdgeConfig>
> = Document & {
  [key in keyof Edges as Edges[key]["cardinality"] extends "single"
    ? never
    : key]?: {
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
