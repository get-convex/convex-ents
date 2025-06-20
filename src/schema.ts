import {
  DataModelFromSchemaDefinition,
  DefineSchemaOptions,
  GenericDataModel,
  GenericTableIndexes,
  GenericTableSearchIndexes,
  GenericTableVectorIndexes,
  SchemaDefinition,
  SearchIndexConfig,
  TableDefinition,
  VectorIndexConfig,
  defineSchema,
} from "convex/server";
import {
  GenericId,
  GenericValidator,
  ObjectType,
  PropertyValidators,
  VAny,
  VFloat64,
  VId,
  VObject,
  VOptional,
  VUnion,
  Validator,
  asObjectValidator,
  v,
} from "convex/values";

export function defineEntSchema<
  Schema extends Record<string, EntDefinition>,
  StrictTableNameTypes extends boolean = true,
>(
  schema: Schema,
  options?: DefineSchemaOptions<StrictTableNameTypes>,
): SchemaDefinition<Schema, StrictTableNameTypes> {
  // Set the properties of edges which requires knowing their inverses,
  // and add edge tables.
  const tableNames = Object.keys(schema);
  for (const tableName of tableNames) {
    const table = schema[tableName];
    for (const edge of edgeConfigsBeforeDefineSchema(table)) {
      if (
        // Skip inverse edges, we process their forward edges
        edge.cardinality === "multiple" &&
        edge.type === "ref" &&
        (edge.inverse !== undefined ||
          // symmetric is only set by defineEntSchema,
          // so we already processed the pair
          (edge as unknown as EdgeConfigMultipleRef).symmetric !== undefined)
      ) {
        continue;
      }

      const otherTableName = edge.to;
      if (otherTableName.startsWith("_")) {
        if (edge.cardinality !== "single") {
          throw new Error(
            `Many:many edge "${edge.name}" in table "${tableName}" ` +
              `points to a system table "${otherTableName}", but only 1:1 ` +
              `edges can point to system tables`,
          );
        }
        if (edge.type !== "field") {
          throw new Error(
            `Edge "${edge.name}" in table "${tableName}" ` +
              `pointing to a system table "${otherTableName}" must store ` +
              `the edge by storing the system document ID. Remove ` +
              `the \`ref\` option.`,
          );
        }
        if (edge.deletion === "soft") {
          throw new Error(
            `Edge "${edge.name}" in table "${tableName}" ` +
              `pointing to a system table "${otherTableName}" cannot use ` +
              `soft deletion, because system documents cannot be soft deleted.`,
          );
        }
        // Nothing else to do, the edge is set up.
        continue;
      }
      const otherTable = schema[otherTableName];
      if (otherTable === undefined) {
        throw new Error(
          `Edge "${edge.name}" in table "${tableName}" ` +
            `points to an undefined table "${otherTableName}"`,
        );
      }

      const isSelfDirected = edge.to === tableName;

      const inverseEdgeCandidates = edgeConfigsBeforeDefineSchema(
        otherTable,
      ).filter(canBeInverseEdge(tableName, edge, isSelfDirected));
      if (inverseEdgeCandidates.length > 1) {
        throw new Error(
          `Edge "${edge.name}" in table "${tableName}" ` +
            `has too many potential inverse edges in table "${otherTableName}": ` +
            `${inverseEdgeCandidates
              .map((edge) => `"${edge.name}"`)
              .join(", ")}`,
        );
      }
      const inverseEdge: EdgeConfigBeforeDefineSchema | undefined =
        inverseEdgeCandidates[0];

      if (
        edge.cardinality === "single" &&
        edge.type === "field" &&
        inverseEdge === undefined
      ) {
        throw new Error(
          `Missing inverse edge in table "${otherTableName}" ` +
            `for edge "${edge.name}" in table "${tableName}"`,
        );
      }

      // Default `ref` on the multiple end of the edge,
      if (edge.cardinality === "single" && edge.type === "ref") {
        if (inverseEdge === undefined) {
          throw new Error(
            `Missing inverse edge in table "${otherTableName}" ${
              edge.ref !== null ? `with field "${edge.ref}" ` : ""
            }for edge "${edge.name}" in table "${tableName}"`,
          );
        }
        if (
          inverseEdge.cardinality === "single" &&
          inverseEdge.type === "ref"
        ) {
          throw new Error(
            `Both edge "${edge.name}" in table "${inverseEdge.to}" and ` +
              `edge "${inverseEdge.name}" in table "${edge.to}" are marked ` +
              `as references, choose one to store the edge by removing ` +
              `the \`ref\` option.`,
          );
        }
        if (
          inverseEdge.cardinality !== "single" ||
          inverseEdge.type !== "field"
        ) {
          throw new Error(
            `Unexpected inverse edge type ${edge.name}, ${inverseEdge?.name}`,
          );
        }
        if (edge.ref === null) {
          (edge as EdgeConfigSingleRef).ref = inverseEdge.field;
        }
        // For now the the non-optional end is always unique
        (inverseEdge as EdgeConfigSingleField).unique = true;
      }
      if (
        edge.cardinality === "single" ||
        (edge.cardinality === "multiple" && edge.type === "field")
      ) {
        if (
          edge.deletion !== undefined &&
          deletionConfigFromEntDefinition(otherTable) === undefined
        ) {
          throw new Error(
            `Cannot specify soft deletion behavior for edge ` +
              `"${edge.name}" in table "${tableName}" ` +
              `because the target table "${otherTableName}" does not have ` +
              `a "soft" or "scheduled" deletion behavior ` +
              `configured.`,
          );
        }
      }
      if (edge.cardinality === "multiple") {
        if (!isSelfDirected && inverseEdge === undefined) {
          throw new Error(
            `Missing inverse edge in table "${otherTableName}" ` +
              `for edge "${edge.name}" in table "${tableName}"`,
          );
        }

        if (inverseEdge?.cardinality === "single") {
          if (inverseEdge.type === "ref") {
            throw new Error(
              `The edge "${inverseEdge.name}" in table "${otherTableName}" ` +
                `specified \`ref\`, but it must store the 1:many edge as a field. ` +
                `Check the its inverse edge "${edge.name}" in table "${tableName}".`,
            );
          }
          if (edge.type === "ref") {
            throw new Error(
              `The edge "${inverseEdge.name}" in table "${otherTableName}" ` +
                `cannot be singular, as the edge "${edge.name}" in table "${tableName}" did not ` +
                `specify the \`ref\` option.`,
            );
          }
          (edge as EdgeConfigMultipleField).type = "field";
          (edge as EdgeConfigMultipleField).ref = inverseEdge.field;
        }

        if (inverseEdge?.cardinality === "multiple" || isSelfDirected) {
          if (!isSelfDirected && edge?.type === "field") {
            throw new Error(
              `The edge "${edge.name}" in table "${tableName}" ` +
                `specified \`ref\`, but its inverse edge "${inverseEdge.name}" ` +
                `in table "${otherTableName}" is not the singular end of a 1:many edge.`,
            );
          }
          if (inverseEdge?.type === "field") {
            throw new Error(
              `The edge "${inverseEdge.name}" in table "${otherTableName}" ` +
                `specified \`ref\`, but its inverse edge "${edge.name}" ` +
                `in table "${tableName}" is not the singular end of a 1:many edge.`,
            );
          }

          const edgeTableName =
            edge.type === "ref" && edge.table !== undefined
              ? edge.table
              : inverseEdge === undefined
                ? `${tableName}_${edge.name}`
                : inverseEdge.name !== tableName
                  ? `${tableName}_${inverseEdge.name}_to_${edge.name}`
                  : `${inverseEdge.name}_to_${edge.name}`;

          const forwardId =
            edge.type === "ref" && edge.field !== undefined
              ? edge.field
              : inverseEdge === undefined
                ? "aId"
                : tableName === otherTableName
                  ? inverseEdge.name + "Id"
                  : tableName + "Id";
          const inverseId =
            isSelfDirected &&
            edge.type === "ref" &&
            edge.inverseField !== undefined
              ? edge.inverseField
              : inverseEdge === undefined
                ? "bId"
                : inverseEdge.type === "ref" && inverseEdge.field !== undefined
                  ? inverseEdge.field
                  : tableName === otherTableName
                    ? edge.name + "Id"
                    : otherTableName + "Id";
          // Add the table
          const edgeTable = defineEnt({
            [forwardId]: v.id(tableName),
            [inverseId]: v.id(otherTableName),
          })
            .index(forwardId, [forwardId])
            .index(inverseId, [inverseId])
            .index(edgeCompoundIndexNameRaw(forwardId, inverseId), [
              forwardId,
              inverseId,
            ]);
          const isSymmetric = inverseEdge === undefined;
          if (!isSymmetric) {
            edgeTable.index(edgeCompoundIndexNameRaw(inverseId, forwardId), [
              inverseId,
              forwardId,
            ]);
          }
          (schema as Record<string, EntDefinition>)[edgeTableName] = edgeTable;
          const edgeConfig = edge as unknown as EdgeConfigMultipleRef;
          edgeConfig.type = "ref";
          edgeConfig.table = edgeTableName;
          edgeConfig.field = forwardId;
          edgeConfig.ref = inverseId;
          edgeConfig.symmetric = inverseEdge === undefined;
          if (inverseEdge !== undefined) {
            inverseEdge.type = "ref";
            const inverseEdgeConfig =
              inverseEdge as unknown as EdgeConfigMultipleRef;
            inverseEdgeConfig.table = edgeTableName;
            inverseEdgeConfig.field = inverseId;
            inverseEdgeConfig.ref = forwardId;
            inverseEdgeConfig.symmetric = false;
          }
        }
      }
    }
  }
  return defineSchema(schema, options);
}

export function edgeCompoundIndexName(
  edgeDefinition: EdgeConfig & { cardinality: "multiple"; type: "ref" },
) {
  return edgeCompoundIndexNameRaw(edgeDefinition.field, edgeDefinition.ref);
}

function edgeCompoundIndexNameRaw(idA: string, idB: string) {
  return `${idA}_${idB}`;
}

function canBeInverseEdge(
  tableName: string,
  edge: EdgeConfigBeforeDefineSchema,
  isSelfDirected: boolean,
) {
  return (candidate: EdgeConfigBeforeDefineSchema) => {
    if (candidate.to !== tableName) {
      return false;
    }
    // Simple: pick out explicit inverse edges
    if (isSelfDirected) {
      return (
        candidate.cardinality === "multiple" &&
        candidate.type === "ref" &&
        candidate.inverse === edge.name
      );
    }
    // If both ref and field are known, only consider matching edges (from the ref side)
    if (
      (edge.cardinality === "single" &&
        edge.type === "ref" &&
        edge.ref !== null) ||
      (edge.cardinality === "multiple" &&
        edge.type === "field" &&
        edge.ref !== true)
    ) {
      if (candidate.cardinality === "single" && candidate.type === "field") {
        return edge.ref === candidate.field;
      }
    }
    // If both ref and field are known, only consider matching edges (from the field side)
    if (
      edge.cardinality === "single" &&
      edge.type === "field" &&
      edge.field !== null
    ) {
      if (
        (candidate.cardinality === "single" &&
          candidate.type === "ref" &&
          candidate.ref !== null) ||
        (candidate.cardinality === "multiple" &&
          candidate.type === "field" &&
          candidate.ref !== true)
      ) {
        return edge.field === candidate.ref;
      }
    }

    // If table is known on both ends, only consider matching edges
    if (
      edge.cardinality === "multiple" &&
      edge.type === "ref" &&
      edge.table !== undefined
    ) {
      return (
        candidate.cardinality === "multiple" &&
        candidate.type === "ref" &&
        edge.table === candidate.table
      );
    }
    if (
      candidate.cardinality === "multiple" &&
      candidate.type === "ref" &&
      candidate.table !== undefined
    ) {
      return (
        edge.cardinality === "multiple" &&
        edge.type === "ref" &&
        edge.table === candidate.table
      );
    }
    return true;
  };
}

function edgeConfigsBeforeDefineSchema(table: EntDefinition) {
  return Object.values(
    (table as any).edgeConfigs as Record<string, EdgeConfigBeforeDefineSchema>,
  );
}

function deletionConfigFromEntDefinition(table: EntDefinition) {
  return (table as any).deletionConfig as DeletionConfig | undefined;
}

export function defineEnt<
  DocumentSchema extends Validator<Record<string, any>, "required", any>,
>(documentSchema: DocumentSchema): EntDefinition<DocumentSchema>;

export function defineEnt<
  DocumentSchema extends Record<string, GenericValidator>,
>(
  documentSchema: DocumentSchema,
): EntDefinition<VObject<ObjectType<DocumentSchema>, DocumentSchema>>;

export function defineEnt<
  DocumentSchema extends
    | Validator<Record<string, any>, "required", any>
    | Record<string, GenericValidator>,
>(documentSchema: DocumentSchema): EntDefinition<any> {
  if (isValidator(documentSchema)) {
    if (
      !(
        documentSchema.kind === "object" ||
        (documentSchema.kind === "union" &&
          documentSchema.members.every((member) => member.kind === "object"))
      )
    ) {
      throw new Error("Ent shape must be an object or a union of objects");
    }
  }
  return new EntDefinitionImpl(asObjectValidator(documentSchema)) as any;
}

function isValidator(v: any): v is GenericValidator {
  return !!v.isConvexValidator;
}

export function defineEntFromTable<
  DocumentType extends GenericValidator = GenericValidator,
  // eslint-disable-next-line @typescript-eslint/ban-types
  Indexes extends GenericTableIndexes = {},
  // eslint-disable-next-line @typescript-eslint/ban-types
  SearchIndexes extends GenericTableSearchIndexes = {},
  // eslint-disable-next-line @typescript-eslint/ban-types
  VectorIndexes extends GenericTableVectorIndexes = {},
>(
  definition: TableDefinition<
    DocumentType,
    Indexes,
    SearchIndexes,
    VectorIndexes
  >,
): EntDefinition<DocumentType, Indexes, SearchIndexes, VectorIndexes> {
  const validator: DocumentType = definition.validator;
  if (validator.kind !== "object") {
    throw new Error(
      "Only tables with object definition are supported in Ents, not unions",
    );
  }

  const entDefinition = defineEnt(validator.fields);
  // @ts-expect-error Private fields
  entDefinition.indexes = definition.indexes;
  // @ts-expect-error Private fields
  entDefinition.searchIndexes = definition.searchIndexes;
  // @ts-expect-error Private fields
  entDefinition.vectorIndexes = definition.vectorIndexes;
  return entDefinition as any;
}

type DefineEntFromTables<
  T extends { [key: string]: TableDefinition<any, any, any, any> },
> = {
  [K in keyof T]: T[K] extends TableDefinition<
    infer D,
    infer I,
    infer S,
    infer V
  >
    ? EntDefinition<D, I, S, V>
    : never;
};

export function defineEntsFromTables<
  T extends { [key: string]: TableDefinition<any, any, any, any> },
>(definitions: T): DefineEntFromTables<T> {
  const result: any = {};
  for (const key in definitions) {
    result[key] = defineEntFromTable(definitions[key]);
  }
  return result;
}

type GenericEdges = Record<string, GenericEdgeConfig>;

export type GenericEdgeConfig = {
  name: string;
  to: string;
  cardinality: "single" | "multiple";
  type: "field" | "ref";
  optional?: boolean;
};

type ExtractFieldPaths<T extends Validator<any, any, any>> =
  // Add in the system fields available in index definitions.
  // This should be everything except for `_id` because thats added to indexes
  // automatically.
  T["fieldPaths"] | keyof SystemFields;

type ObjectFieldType<
  FieldName extends string,
  T extends Validator<any, any, any>,
> = T["isOptional"] extends "optional"
  ? { [key in FieldName]?: T["type"] }
  : { [key in FieldName]: T["type"] };

type AddField<
  V extends GenericValidator,
  FieldName extends string,
  P extends GenericValidator,
> =
  // Note: We can't use the `AddField` type to add fields to a union type, but ents
  // do not support schemas with top level unions
  V extends VObject<
    infer TypeScriptType,
    infer Fields,
    infer IsOptional,
    infer FieldPaths
  >
    ? VObject<
        Expand<TypeScriptType & ObjectFieldType<FieldName, P>>,
        Expand<Fields & { FieldName: P }>,
        IsOptional,
        FieldPaths | FieldName
      >
    : V extends VUnion<
          infer TypeScriptType,
          infer Members,
          infer IsOptional,
          infer FieldPaths
        >
      ? VUnion<
          Expand<TypeScriptType & ObjectFieldType<FieldName, P>>,
          { [key in keyof Members]: AddField<Members[key], FieldName, P> },
          IsOptional,
          FieldPaths | FieldName
        >
      : V extends VAny
        ? VAny
        : never;

export interface EntDefinition<
  DocumentType extends Validator<any, any, any> = Validator<any, any, any>,
  // eslint-disable-next-line @typescript-eslint/ban-types
  Indexes extends GenericTableIndexes = {},
  // eslint-disable-next-line @typescript-eslint/ban-types
  SearchIndexes extends GenericTableSearchIndexes = {},
  // eslint-disable-next-line @typescript-eslint/ban-types
  VectorIndexes extends GenericTableVectorIndexes = {},
  // eslint-disable-next-line @typescript-eslint/ban-types
  Edges extends GenericEdges = {},
> extends TableDefinition<DocumentType, Indexes, SearchIndexes, VectorIndexes> {
  /**
   * Define an index on this table.
   *
   * To learn about indexes, see [Defining Indexes](https://docs.convex.dev/using/indexes).
   *
   * @param name - The name of the index.
   * @param fields - The fields to index, in order. Must specify at least one
   * field.
   * @returns A {@link TableDefinition} with this index included.
   */
  index<
    IndexName extends string,
    FirstFieldPath extends ExtractFieldPaths<DocumentType>,
    RestFieldPaths extends ExtractFieldPaths<DocumentType>[],
  >(
    name: IndexName,
    fields: [FirstFieldPath, ...RestFieldPaths],
  ): EntDefinition<
    DocumentType,
    Expand<
      Indexes &
        Record<IndexName, [FirstFieldPath, ...RestFieldPaths, "_creationTime"]>
    >,
    SearchIndexes,
    VectorIndexes,
    Edges
  >;

  /**
   * Define a search index on this table.
   *
   * To learn about search indexes, see [Search](https://docs.convex.dev/text-search).
   *
   * @param name - The name of the index.
   * @param indexConfig - The search index configuration object.
   * @returns A {@link TableDefinition} with this search index included.
   */
  searchIndex<
    IndexName extends string,
    SearchField extends ExtractFieldPaths<DocumentType>,
    FilterFields extends ExtractFieldPaths<DocumentType> = never,
  >(
    name: IndexName,
    indexConfig: Expand<SearchIndexConfig<SearchField, FilterFields>>,
  ): EntDefinition<
    DocumentType,
    Indexes,
    Expand<
      SearchIndexes &
        Record<
          IndexName,
          {
            searchField: SearchField;
            filterFields: FilterFields;
          }
        >
    >,
    VectorIndexes,
    Edges
  >;

  // /**
  //  * Define a vector index on this table.
  //  *
  //  * To learn about vector indexes, see [Vector Search](https://docs.convex.dev/vector-search).
  //  *
  //  * @param name - The name of the index.
  //  * @param indexConfig - The vector index configuration object.
  //  * @returns A {@link TableDefinition} with this vector index included.
  //  */
  vectorIndex<
    IndexName extends string,
    VectorField extends ExtractFieldPaths<DocumentType>,
    FilterFields extends ExtractFieldPaths<DocumentType> = never,
  >(
    name: IndexName,
    indexConfig: Expand<VectorIndexConfig<VectorField, FilterFields>>,
  ): EntDefinition<
    DocumentType,
    Indexes,
    SearchIndexes,
    Expand<
      VectorIndexes &
        Record<
          IndexName,
          {
            vectorField: VectorField;
            dimensions: number;
            filterFields: FilterFields;
          }
        >
    >,
    Edges
  >;

  field<FieldName extends string, T extends GenericValidator>(
    field: FieldName,
    validator: T,
  ): EntDefinition<
    AddField<DocumentType, FieldName, T>,
    Indexes,
    SearchIndexes,
    VectorIndexes,
    Edges
  >;
  field<FieldName extends string, T extends Validator<any, any, any>>(
    field: FieldName,
    validator: T,
    options: { index: true },
  ): EntDefinition<
    AddField<DocumentType, FieldName, T>,
    Indexes & { [key in FieldName]: [FieldName, "_creationTime"] },
    SearchIndexes,
    VectorIndexes,
    Edges
  >;
  field<FieldName extends string, T extends Validator<any, any, any>>(
    field: FieldName,
    validator: T,
    options: { unique: true },
  ): EntDefinition<
    AddField<DocumentType, FieldName, T>,
    Indexes & { [key in FieldName]: [FieldName, "_creationTime"] },
    SearchIndexes,
    VectorIndexes,
    Edges
  >;
  field<FieldName extends string, T extends Validator<any, "required", any>>(
    field: FieldName,
    validator: T,
    options: { default: T["type"] },
  ): EntDefinition<
    AddField<DocumentType, FieldName, T>,
    Indexes,
    SearchIndexes,
    VectorIndexes,
    Edges
  >;

  edge<EdgeName extends string>(
    edge: EdgeName,
    options?: { deletion: "hard" | "soft" },
  ): EntDefinition<
    AddField<DocumentType, `${EdgeName}Id`, VId<GenericId<`${EdgeName}s`>>>,
    Indexes & { [key in `${EdgeName}Id`]: [`${EdgeName}Id`, "_creationTime"] },
    SearchIndexes,
    VectorIndexes,
    Edges & {
      [key in EdgeName]: {
        name: EdgeName;
        to: `${EdgeName}s`;
        type: "field";
        cardinality: "single";
        optional: false;
      };
    }
  >;
  edge<EdgeName extends string, const FieldName extends string>(
    edge: EdgeName,
    options: { field: FieldName; deletion?: "hard" | "soft" },
  ): EntDefinition<
    AddField<DocumentType, NoInfer<FieldName>, VId<GenericId<`${EdgeName}s`>>>,
    Indexes & {
      [key in NoInfer<FieldName>]: [NoInfer<FieldName>, "_creationTime"];
    },
    SearchIndexes,
    VectorIndexes,
    Edges & {
      [key in EdgeName]: {
        name: EdgeName;
        to: `${EdgeName}s`;
        type: "field";
        cardinality: "single";
        optional: false;
      };
    }
  >;
  edge<EdgeName extends string, const FieldName extends string>(
    edge: EdgeName,
    options: {
      field: FieldName;
      optional: true;
      deletion?: "hard" | "soft";
    },
  ): EntDefinition<
    AddField<
      DocumentType,
      NoInfer<FieldName>,
      VOptional<VId<GenericId<`${EdgeName}s`>>>
    >,
    Indexes & {
      [key in NoInfer<FieldName>]: [NoInfer<FieldName>, "_creationTime"];
    },
    SearchIndexes,
    VectorIndexes,
    Edges & {
      [key in EdgeName]: {
        name: EdgeName;
        to: `${EdgeName}s`;
        type: "field";
        cardinality: "single";
        optional: true;
      };
    }
  >;
  edge<
    EdgeName extends string,
    const FieldName extends string,
    const ToTable extends string,
  >(
    edge: EdgeName,
    options: {
      field: FieldName;
      to: ToTable;
      deletion?: ToTable extends "_storage" | "_scheduled_functions"
        ? "hard"
        : "hard" | "soft";
    },
  ): EntDefinition<
    AddField<DocumentType, NoInfer<FieldName>, VId<GenericId<`${ToTable}`>>>,
    Indexes & {
      [key in NoInfer<FieldName>]: [NoInfer<FieldName>, "_creationTime"];
    },
    SearchIndexes,
    VectorIndexes,
    Edges & {
      [key in EdgeName]: {
        name: EdgeName;
        to: ToTable;
        type: "field";
        cardinality: "single";
        optional: false;
      };
    }
  >;
  edge<EdgeName extends string, const ToTable extends string>(
    edge: EdgeName,
    options: {
      to: ToTable;
      deletion?: ToTable extends "_storage" | "_scheduled_functions"
        ? "hard"
        : "hard" | "soft";
    },
  ): EntDefinition<
    AddField<DocumentType, `${EdgeName}Id`, VId<GenericId<`${ToTable}`>>>,
    Indexes & {
      [key in `${EdgeName}Id`]: [`${EdgeName}Id`, "_creationTime"];
    },
    SearchIndexes,
    VectorIndexes,
    Edges & {
      [key in EdgeName]: {
        name: EdgeName;
        to: ToTable;
        type: "field";
        cardinality: "single";
        optional: false;
      };
    }
  >;
  edge<
    EdgeName extends string,
    const FieldName extends string,
    const ToTable extends string,
  >(
    edge: EdgeName,
    options: {
      field: FieldName;
      to: ToTable;
      optional: true;
      deletion?: ToTable extends "_storage" | "_scheduled_functions"
        ? "hard"
        : "hard" | "soft";
    },
  ): EntDefinition<
    AddField<
      DocumentType,
      NoInfer<FieldName>,
      VOptional<VId<GenericId<ToTable>>>
    >,
    Indexes & {
      [key in NoInfer<FieldName>]: [NoInfer<FieldName>, "_creationTime"];
    },
    SearchIndexes,
    VectorIndexes,
    Edges & {
      [key in EdgeName]: {
        name: EdgeName;
        to: ToTable;
        type: "field";
        cardinality: "single";
        optional: true;
      };
    }
  >;
  edge<EdgeName extends string>(
    edge: EdgeName,
    options: {
      ref: true | string;
      deletion?: "soft";
    },
  ): EntDefinition<
    DocumentType,
    Indexes,
    SearchIndexes,
    VectorIndexes,
    Edges & {
      [key in EdgeName]: {
        name: EdgeName;
        to: `${EdgeName}s`;
        type: "ref";
        cardinality: "single";
      };
    }
  >;
  edge<EdgeName extends string, const ToTable extends string>(
    edge: EdgeName,
    options: {
      to: ToTable;
      ref: true | string;
      deletion?: "soft";
    },
  ): EntDefinition<
    DocumentType,
    Indexes,
    SearchIndexes,
    VectorIndexes,
    Edges & {
      [key in EdgeName]: {
        name: EdgeName;
        to: NoInfer<ToTable>;
        type: "ref";
        cardinality: "single";
      };
    }
  >;

  /**
   * Define many:1 edge to another table.
   * @param edge The name of the edge, also the name of the target table.
   * @param options.ref The name of the field that stores the many:1 edge
   *   on the other table, or `true` to infer it.
   */
  edges<EdgesName extends string>(
    edge: EdgesName,
    options: {
      ref: true | string;
      deletion?: "soft";
    },
  ): EntDefinition<
    DocumentType,
    Indexes,
    SearchIndexes,
    VectorIndexes,
    Edges & {
      [key in EdgesName]: {
        name: EdgesName;
        to: EdgesName;
        type: "field";
        cardinality: "multiple";
      };
    }
  >;
  /**
   * Define many:1 edge to another table.
   * @param edge The name of the edge.
   * @param options.to Name of the table the edge points to.
   *   If it's the same as the table this edge is defined on, this edge is
   *   a symmetric, self-directed many:many edge.
   * @param options.ref The name of the field that stores the many:1 edge
   *   on the other table, or `true` to infer it.
   */
  edges<EdgesName extends string, TableName extends string>(
    edge: EdgesName,
    options: {
      to: TableName;
      ref: true | string;
      deletion?: "soft";
    },
  ): EntDefinition<
    DocumentType,
    Indexes,
    SearchIndexes,
    VectorIndexes,
    Edges & {
      [key in EdgesName]: {
        name: EdgesName;
        to: NoInfer<TableName>;
        type: "field";
        cardinality: "multiple";
      };
    }
  >;

  /**
   * Define many:many edge to another table.
   * @param edge The name of the edge, also the name of the target table.
   * @param options.table Optional, name of the table to store the many:many edge in.
   * @param options.field Optional, name of the field to store the ID of the
   *   this end of the many:many edge.
   */
  edges<EdgesName extends string>(
    edge: EdgesName,
    options?: {
      table?: string;
      field?: string;
    },
  ): EntDefinition<
    DocumentType,
    Indexes,
    SearchIndexes,
    VectorIndexes,
    Edges & {
      [key in EdgesName]: {
        name: EdgesName;
        to: EdgesName;
        type: "ref";
        cardinality: "multiple";
      };
    }
  >;
  /**
   * Define many:many edge to another table.
   * @param edge The name of the edge.
   * @param options.to Name of the table the edge points to.
   *   If it's the same as the table this edge is defined on, this edge is
   *   a symmetric, self-directed many:many edge.
   * @param options.table Optional, name of the table to store the many:many edge in.
   * @param options.field Optional, name of the field to store the ID of the
   *   of the source end of the forward many:many edge.
   * @param options.inverseField Optional, name of the field to store the ID
   *   of the target end of the forward edge. Only allowed for symmetric,
   *   self-directed many:many edges.
   */
  edges<EdgesName extends string, TableName extends string>(
    edge: EdgesName,
    options: {
      to: TableName;
      table?: string;
      field?: string;
      inverseField?: string;
    },
  ): EntDefinition<
    DocumentType,
    Indexes,
    SearchIndexes,
    VectorIndexes,
    Edges & {
      [key in EdgesName]: {
        name: EdgesName;
        to: NoInfer<TableName>;
        type: "ref";
        cardinality: "multiple";
      };
    }
  >;
  /**
   * Define self-directed, assymetric, many:many edge.
   * @param edge The name of the edge.
   * @param options.to Name of the table the edge points to.
   *   Must be the same as the table this edge is defined on.
   * @param options.inverse Name of the inverse edge.
   * @param options.table Optional, name of the table to store the many:many edge in.
   * @param options.field Optional, name of the field to store the ID of the
   *   of the source end of the forward many:many edge.
   * @param options.inverseField Optional, name of the field to store the ID
   *   of the target end of the forward many:many edge.
   */
  edges<
    EdgesName extends string,
    TableName extends string,
    InverseEdgesNames extends string,
  >(
    edge: EdgesName,
    options: {
      to: TableName;
      inverse: InverseEdgesNames;
      table?: string;
      field?: string;
      inverseField?: string;
    },
  ): EntDefinition<
    DocumentType,
    Indexes,
    SearchIndexes,
    VectorIndexes,
    Edges & {
      [key in EdgesName]: {
        name: EdgesName;
        to: NoInfer<TableName>;
        type: "ref";
        cardinality: "multiple";
      };
    } & {
      [key in NoInfer<InverseEdgesNames>]: {
        name: NoInfer<InverseEdgesNames>;
        to: NoInfer<TableName>;
        type: "ref";
        cardinality: "multiple";
      };
    }
  >;

  /**
   * Add the "soft"  deletion behavior to this ent.
   *
   * When the ent is "soft" deleted, its `deletionTime` field is set to the
   * current time and it is not actually deleted.
   *
   * @param type `"soft"`
   */
  deletion(
    type: "soft",
  ): EntDefinition<
    AddField<DocumentType, "deletionTime", VOptional<VFloat64>>,
    Indexes,
    SearchIndexes,
    VectorIndexes,
    Edges
  >;
  /**
   * Add the "scheduled" deletion behavior to this ent.
   *
   * The ent is first "soft" deleted and its hard deletion is scheduled
   * to run in a separate mutation.
   *
   * @param type `"scheduled"`
   * @param options.delayMs If the `delayMs` option is specified,
   *   the hard deletion is scheduled to happen after the specified
   *   time duration.
   */
  deletion(
    type: "scheduled",
    options?: {
      delayMs: number;
    },
  ): EntDefinition<
    AddField<DocumentType, "deletionTime", VOptional<VFloat64>>,
    Indexes,
    SearchIndexes,
    VectorIndexes,
    Edges
  >;
}

type NoInfer<T> = [T][T extends any ? 0 : never];

type FieldOptions = {
  index?: true;
  unique?: true;
  default?: any;
};

type EdgeOptions = {
  optional?: true;
  field?: string;
  ref?: true | string;
  to?: string;
  deletion?: "soft" | "hard";
};

type EdgesOptions = {
  to?: string;
  inverse?: string;
  ref?: string;
  table?: string;
  field?: string;
  inverseField?: string;
  deletion: "soft";
};

class EntDefinitionImpl {
  validator: Validator<Record<string, any>, "required", any>;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  private indexes: Index[] = [];
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  private searchIndexes: SearchIndex[] = [];
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  private vectorIndexes: VectorIndex[] = [];

  private edgeConfigs: Record<string, EdgeConfigBeforeDefineSchema> = {};

  private fieldConfigs: Record<string, FieldConfig> = {};

  private defaults: Record<string, any> = {};

  private deletionConfig: DeletionConfig | undefined;

  constructor(documentSchema: Validator<Record<string, any>, "required", any>) {
    this.validator = documentSchema;
  }

  index(name: any, fields: any) {
    this.indexes.push({ indexDescriptor: name, fields });
    return this;
  }

  searchIndex(name: any, indexConfig: any) {
    this.searchIndexes.push({
      indexDescriptor: name,
      searchField: indexConfig.searchField,
      filterFields: indexConfig.filterFields || [],
    });
    return this;
  }

  vectorIndex(name: any, indexConfig: any) {
    this.vectorIndexes.push({
      indexDescriptor: name,
      vectorField: indexConfig.vectorField,
      dimensions: indexConfig.dimensions,
      filterFields: indexConfig.filterFields || [],
    });
    return this;
  }

  /**
   * Export the contents of this definition.
   *
   * This is called internally by the Convex framework.
   * @internal
   */
  export() {
    return {
      indexes: this.indexes,
      searchIndexes: this.searchIndexes,
      vectorIndexes: this.vectorIndexes,
      documentType: (this.validator as any).json,
    };
  }

  field(name: string, validator: any, options?: FieldOptions): this {
    if (this._has(name)) {
      // TODO: Store the fieldConfigs in an array so that we can
      // do the uniqueness check in defineEntSchema where we
      // know the table name.
      throw new Error(`Duplicate field "${name}"`);
    }
    const finalValidator =
      options?.default !== undefined ? v.optional(validator) : validator;
    this._expand(name, finalValidator);
    if (options?.unique === true || options?.index === true) {
      this.indexes.push({ indexDescriptor: name, fields: [name] });
    }
    if (options?.default !== undefined) {
      this.defaults[name] = options.default;
    }
    if (options?.unique === true) {
      this.fieldConfigs[name] = { name, unique: true };
    }
    return this;
  }

  edge(edgeName: string, options?: EdgeOptions): this {
    if (this.edgeConfigs[edgeName] !== undefined) {
      // TODO: Store the edgeConfigs in an array so that we can
      // do the uniqueness check in defineEntSchema where we
      // know the source table name.
      throw new Error(`Duplicate edge "${edgeName}"`);
    }
    const to = options?.to ?? edgeName + "s";
    if (options?.field !== undefined && options?.ref !== undefined) {
      throw new Error(
        `Cannot specify both \`field\` and \`ref\` for the same edge, ` +
          `choose one to be the reference and the other to store ` +
          `the foreign key.`,
      );
    }
    if (options?.field !== undefined || options?.ref === undefined) {
      const fieldName = options?.field ?? edgeName + "Id";
      this._expand(
        fieldName,
        options?.optional === true ? v.optional(v.id(to)) : v.id(to),
      );
      this.edgeConfigs[edgeName] = {
        name: edgeName,
        to,
        cardinality: "single",
        type: "field",
        field: fieldName,
        optional: options?.optional === true,
        deletion: options?.deletion,
      };
      this.indexes.push({
        indexDescriptor: fieldName,
        fields: [fieldName],
      });
      return this;
    }
    this.edgeConfigs[edgeName] = {
      name: edgeName,
      to,
      cardinality: "single",
      type: "ref",
      ref: options.ref === true ? null : options.ref,
      deletion: options.deletion as "soft" | undefined,
    };
    return this;
  }

  edges(name: string, options?: EdgesOptions): this {
    const cardinality = "multiple";
    const to = options?.to ?? name;
    const ref = options?.ref;
    const table = options?.table;
    // TODO: Do this later when we have the table name,
    // or rework schema to use a builder pattern.
    if (ref !== undefined && table !== undefined) {
      throw new Error(
        `Cannot specify both \`ref\` and \`table\` for the same edge, ` +
          `as the former is for 1:many edges and the latter ` +
          `for many:many edges. Config: \`${JSON.stringify(options)}\``,
      );
    }
    const field = options?.field;
    const inverseField = options?.inverseField;
    // TODO: Do this later when we have the table name,
    // or rework schema to use a builder pattern.
    if (
      (field !== undefined || inverseField !== undefined) &&
      table === undefined
    ) {
      throw new Error(
        `Specify \`table\` if you're customizing the \`field\` or ` +
          `\`inverseField\` for a many:many edge. ` +
          `Config: \`${JSON.stringify(options)}\``,
      );
    }
    const inverseName = options?.inverse;
    const deletion = options?.deletion;
    this.edgeConfigs[name] =
      ref !== undefined
        ? { name, to, cardinality, type: "field", ref, deletion }
        : { name, to, cardinality, type: "ref", table, field, inverseField };
    if (inverseName !== undefined) {
      this.edgeConfigs[inverseName] = {
        name: inverseName,
        to,
        cardinality,
        type: "ref",
        inverse: name,
        table,
      };
    }
    return this;
  }

  deletion(type: "soft" | "scheduled", options?: { delayMs: number }): this {
    if (this._has("deletionTime")) {
      // TODO: Put the check where we know the table name.
      throw new Error(
        `Cannot enable "${type}" deletion because "deletionTime" field ` +
          `was already defined.`,
      );
    }
    if (this.deletionConfig !== undefined) {
      // TODO: Put the check where we know the table name.
      throw new Error(`Deletion behavior can only be specified once.`);
    }
    this._expand("deletionTime", v.optional(v.number()));
    this.deletionConfig = { type, ...options };
    return this;
  }

  private _has(name: string): boolean {
    if (this.validator.kind === "object") {
      return this.validator.fields[name] !== undefined;
    }
    if (this.validator.kind === "union") {
      return this.validator.members.some(
        (member) =>
          member.kind === "object" && member.fields[name] !== undefined,
      );
    }
    return false;
  }

  private _expand(name: string, validator: GenericValidator) {
    if (this.validator.kind === "object") {
      this.validator.fields[name] = validator;
    }
    if (this.validator.kind === "union") {
      this.validator.members.forEach((member) => {
        if (member.kind === "object") {
          member.fields[name] = validator;
        }
      });
    }
  }
}

export type EdgeConfig = {
  name: string;
  to: string;
} & (
  | ({
      cardinality: "single";
    } & (
      | {
          type: "field";
          field: string;
          unique: boolean;
          optional: boolean;
          deletion?: "soft" | "hard";
        }
      | {
          type: "ref";
          ref: string;
          deletion?: "soft";
        }
    ))
  | ({
      cardinality: "multiple";
    } & (
      | {
          type: "field";
          ref: string;
          deletion?: "soft";
        }
      | {
          type: "ref";
          table: string;
          field: string;
          ref: string;
          inverse: boolean;
          symmetric: boolean;
        }
    ))
);

type EdgeConfigSingleField = Extract<
  EdgeConfig,
  {
    type: "field";
    cardinality: "single";
  }
>;
type EdgeConfigSingleRef = Extract<
  EdgeConfig,
  {
    type: "ref";
    cardinality: "single";
  }
>;
type EdgeConfigMultipleField = Extract<
  EdgeConfig,
  {
    type: "field";
    cardinality: "multiple";
  }
>;
type EdgeConfigMultipleRef = Extract<
  EdgeConfig,
  {
    type: "ref";
    cardinality: "multiple";
  }
>;

type EdgeConfigBeforeDefineSchema = {
  name: string;
  to: string;
} & (
  | ({
      cardinality: "single";
    } & (
      | {
          type: "field";
          field: string;
          optional: boolean;
          deletion?: "soft" | "hard";
        }
      | {
          type: "ref";
          ref: null | string;
          deletion?: "soft";
        }
    ))
  | ({
      cardinality: "multiple";
    } & (
      | {
          type: "field";
          ref: true | string;
          deletion?: "soft";
        }
      | {
          type: "ref";
          table?: string;
          field?: string;
          inverseField?: string;
          inverse?: string;
        }
    ))
);

export type FieldConfig = {
  name: string;
  unique: boolean;
};

export type Expand<ObjectType extends Record<any, any>> =
  ObjectType extends Record<any, any>
    ? {
        [Key in keyof ObjectType]: ObjectType[Key];
      }
    : never;
export type SystemFields = {
  _creationTime: number;
};

type ObjectValidator<Validators extends PropertyValidators> = VObject<
  // Compute the TypeScript type this validator refers to.
  ObjectType<Validators>,
  Validators
>;

export type GenericEntsDataModel = GenericDataModel &
  Record<string, GenericEntModel>;

export type GenericEntModel = {
  edges: Record<string, GenericEdgeConfig>;
};

export type DeletionConfig =
  | {
      type: "soft";
    }
  | {
      type: "scheduled";
      delayMs?: number;
    };

export type EntDataModelFromSchema<
  SchemaDef extends SchemaDefinition<any, boolean>,
> = DataModelFromSchemaDefinition<SchemaDef> & {
  [TableName in keyof SchemaDef["tables"] &
    string]: SchemaDef["tables"][TableName] extends EntDefinition<
    any,
    any,
    any,
    any,
    infer Edges
  >
    ? {
        edges: Edges;
      }
    : never;
};

export function getEntDefinitions<
  SchemaDef extends SchemaDefinition<any, boolean>,
>(schema: SchemaDef): EntDataModelFromSchema<typeof schema> {
  const tables = schema.tables;
  return Object.entries(tables).reduce(
    (acc, [tableName, table]: [any, any]) => {
      acc[tableName] = {
        indexes: (
          table.indexes as {
            indexDescriptor: string;
            fields: string[];
          }[]
        ).reduce(
          (acc, { indexDescriptor, fields }) => {
            acc[indexDescriptor] = fields;
            return acc;
          },
          {} as Record<string, string[]>,
        ),
        defaults: table.defaults,
        edges: table.edgeConfigs,
        fields: table.fieldConfigs,
        deletionConfig: table.deletionConfig,
      };
      return acc;
    },
    {} as Record<string, any>,
  ) as any;
}
