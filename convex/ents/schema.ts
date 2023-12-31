import {
  DefineSchemaOptions,
  GenericDataModel,
  GenericDocument,
  GenericSchema,
  GenericTableIndexes,
  GenericTableSearchIndexes,
  GenericTableVectorIndexes,
  SchemaDefinition,
  TableDefinition,
  TableNamesInDataModel,
  defineSchema,
} from "convex/server";
import {
  GenericId,
  ObjectType,
  PropertyValidators,
  Validator,
  v,
} from "convex/values";

export function defineEntSchema<
  Schema extends Record<string, EntDefinition>,
  StrictTableNameTypes extends boolean = true
>(
  schema: Schema,
  options?: DefineSchemaOptions<StrictTableNameTypes>
): SchemaDefinition<Schema, StrictTableNameTypes> {
  // If we have two ref edges pointing at each other,
  // we gotta add the table for them with indexes
  const tableNames = Object.keys(schema);
  for (const tableName of tableNames) {
    const table = schema[tableName];
    for (const edge of (table as any)
      .edgeConfigs as EdgeConfigFromEntDefinition[]) {
      if (edge.cardinality === "multiple") {
        if (edge.type !== null) {
          continue;
        }
        const otherTableName = edge.to;
        const otherTable = schema[otherTableName];
        if (otherTable === undefined) {
          continue;
        }
        const isSelfDirected = edge.to === tableName;
        const inverseEdgeCandidates = (
          (otherTable as any).edgeConfigs as EdgeConfigFromEntDefinition[]
        ).filter(
          (candidate) =>
            candidate.to === tableName &&
            candidate.name !== edge.name &&
            (!isSelfDirected || (candidate.type === null && candidate.inverse))
        );
        if (inverseEdgeCandidates.length > 1) {
          throw new Error(
            'Too many potential inverse edges for "' +
              edge.name +
              `", all eligible: ${inverseEdgeCandidates
                .map((edge) => `"${edge.name}"`)
                .join(", ")}`
          );
        }
        const inverseEdge: EdgeConfigFromEntDefinition | undefined =
          inverseEdgeCandidates[0];

        if (inverseEdge?.cardinality === "single") {
          if (inverseEdge.type === "ref") {
            throw new Error(
              "Unexpected optional edge for " +
                edge.name +
                " called " +
                inverseEdge.name
            );
          }
          (edge as any).type = "field";
          (edge as any).ref = inverseEdge.field;
        }

        if (inverseEdge?.cardinality === "multiple" || isSelfDirected) {
          const edgeTableName =
            inverseEdge === undefined
              ? `${tableName}_${edge.name}`
              : inverseEdge.name !== tableName
              ? `${tableName}_${inverseEdge.name}_to_${edge.name}`
              : `${inverseEdge.name}_to_${edge.name}`;

          const forwardId =
            inverseEdge === undefined
              ? "aId"
              : tableName === otherTableName
              ? inverseEdge.name + "Id"
              : tableName + "Id";
          const inverseId =
            inverseEdge === undefined
              ? "bId"
              : tableName === otherTableName
              ? edge.name + "Id"
              : otherTableName + "Id";
          // Add the table
          (schema as any)[edgeTableName] = defineEnt({
            [forwardId]: v.id(tableName),
            [inverseId]: v.id(otherTableName),
          })
            .index(forwardId, [forwardId])
            .index(inverseId, [inverseId]);

          (edge as any).type = "ref";
          (edge as any).table = edgeTableName;
          (edge as any).field = forwardId;
          (edge as any).ref = inverseId;
          if (inverseEdge !== undefined) {
            inverseEdge.type = "ref";
            (inverseEdge as any).table = edgeTableName;
            (inverseEdge as any).field = inverseId;
            (inverseEdge as any).ref = forwardId;
          }
        }
      }
    }
  }
  return defineSchema(schema, options);
}

export function defineEnt<
  DocumentSchema extends Record<string, Validator<any, any, any>>
>(
  documentSchema: DocumentSchema
): EntDefinition<
  ExtractDocument<ObjectValidator<DocumentSchema>>,
  ExtractFieldPaths<ObjectValidator<DocumentSchema>>
> {
  return new EntDefinitionImpl(documentSchema) as any;
}

type GenericEdges<DataModel extends GenericDataModel> = Record<
  string,
  GenericEdgeConfig<DataModel>
>;

type GenericEdgeConfig<DataModel extends GenericDataModel> = {
  name: string;
  to: TableNamesInDataModel<DataModel>;
  cardinality: "single" | "multiple";
  type: "field" | "ref";
};

interface EntDefinition<
  Document extends GenericDocument = GenericDocument,
  FieldPaths extends string = string,
  // eslint-disable-next-line @typescript-eslint/ban-types
  Indexes extends GenericTableIndexes = {},
  // eslint-disable-next-line @typescript-eslint/ban-types
  SearchIndexes extends GenericTableSearchIndexes = {},
  // eslint-disable-next-line @typescript-eslint/ban-types
  VectorIndexes extends GenericTableVectorIndexes = {},
  // eslint-disable-next-line @typescript-eslint/ban-types
  Edges extends GenericEdges<any> = {}
> extends TableDefinition<
    Document,
    FieldPaths,
    Indexes,
    SearchIndexes,
    VectorIndexes
  > {
  field<
    FieldName extends Exclude<string, keyof Document>,
    T extends Validator<any, any, any>
  >(
    field: FieldName,
    validator: T
  ): EntDefinition<
    Document & { [key in FieldName]: T["type"] },
    FieldPaths | FieldName,
    Indexes,
    SearchIndexes,
    VectorIndexes,
    Edges
  >;
  field<
    FieldName extends Exclude<string, keyof Document>,
    T extends Validator<any, any, any>
  >(
    field: FieldName,
    validator: T,
    options: { index: true }
  ): EntDefinition<
    Document & { [key in FieldName]: T["type"] },
    FieldPaths | FieldName,
    Indexes & { [key in FieldName]: [FieldName] },
    SearchIndexes,
    VectorIndexes,
    Edges
  >;

  edge<EdgeName extends string>(
    edge: EdgeName
  ): EntDefinition<
    Document & { [key in `${EdgeName}Id`]: GenericId<`${EdgeName}s`> },
    FieldPaths | `${EdgeName}Id`,
    Indexes & { [key in `${EdgeName}Id`]: [`${EdgeName}Id`] },
    SearchIndexes,
    VectorIndexes,
    Edges & {
      [key in EdgeName]: {
        name: EdgeName;
        to: `${EdgeName}s`;
        type: "field";
        cardinality: "single";
      };
    }
  >;
  edge<EdgeName extends string>(
    edge: EdgeName,
    options: { optional: true }
  ): EntDefinition<
    Document,
    FieldPaths,
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

  edges<EdgesName extends string>(
    edge: EdgesName
  ): EntDefinition<
    Document,
    FieldPaths,
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
  edges<EdgesName extends string, TableName extends string>(
    edge: EdgesName,
    options: { to: TableName }
  ): EntDefinition<
    Document,
    FieldPaths,
    Indexes,
    SearchIndexes,
    VectorIndexes,
    Edges & {
      [key in EdgesName]: {
        name: EdgesName;
        to: TableName;
        type: "ref";
        cardinality: "multiple";
      };
    }
  >;
  edges<
    EdgesName extends string,
    TableName extends string,
    InverseEdgesNames extends string
  >(
    edge: EdgesName,
    // TODO: When I had `inverse` as a field in the options
    // object TS would infer `InverseEdgesNames` as string
    // in the [key in InverseEdgesNames] type :(((
    inverse: InverseEdgesNames,
    options: { to: TableName }
  ): EntDefinition<
    Document,
    FieldPaths,
    Indexes,
    SearchIndexes,
    VectorIndexes,
    Edges & {
      [key in EdgesName]: {
        name: EdgesName;
        to: TableName;
        type: "ref";
        cardinality: "multiple";
      };
    } & {
      [key in InverseEdgesNames]: {
        name: InverseEdgesNames;
        to: TableName;
        type: "ref";
        cardinality: "multiple";
      };
    }
  >;
  edges(table: string, options: EdgesOptions): this;
}

type FieldOptions = {
  index?: true;
};

type EdgeOptions = {
  optional?: true;
};

type EdgesOptions = {
  to?: string;
  inverse?: string;
};

class EntDefinitionImpl {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  private indexes: Index[];
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  private searchIndexes: SearchIndex[];
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  private vectorIndexes: VectorIndex[];

  private documentSchema: Record<string, Validator<any, any, any>>;

  private edgeConfigs: EdgeConfigFromEntDefinition[];

  constructor(documentSchema: Record<string, Validator<any, any, any>>) {
    this.indexes = [];
    this.searchIndexes = [];
    this.vectorIndexes = [];
    this.documentSchema = documentSchema;
    this.edgeConfigs = [];
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
      documentType: (v.object(this.documentSchema) as any).json,
    };
  }

  field(name: string, validator: any, options?: FieldOptions): this {
    this.documentSchema = { ...this.documentSchema, [name]: validator };
    if (options?.index === true) {
      this.indexes.push({ indexDescriptor: name, fields: [name] });
    }
    return this;
  }

  edge(table: string, options?: EdgeOptions): this {
    if (options === undefined) {
      this.edgeConfigs.push({
        name: table,
        to: table + "s",
        cardinality: "single",
        type: "field",
        field: table + "Id",
      });
      this.indexes.push({
        indexDescriptor: table + "Id",
        fields: [table + "Id"],
      });
      return this;
    }
    if (options.optional === true) {
      this.edgeConfigs.push({
        name: table,
        to: table + "s",
        cardinality: "single",
        type: "ref",
        ref: null, // gets filled in by defineEntSchema
      });
    }
    return this;
  }

  edges(
    name: string,
    options?: string | EdgesOptions,
    otherOptions?: EdgesOptions
  ): this {
    // TODO: When I had `inverse` as a field in the options
    // object TS would infer `InverseEdgesNames` as string
    // so I have to do this complicated implementation
    const finalOptions: EdgesOptions | undefined =
      otherOptions ?? (options as EdgesOptions);
    this.edgeConfigs.push({
      name: name,
      to: finalOptions?.to ?? name,
      cardinality: "multiple",
      type: null, // gets filled in by defineEntSchema
    });
    if (typeof options === "string") {
      this.edgeConfigs.push({
        name: options,
        to: finalOptions?.to ?? name,
        cardinality: "multiple",
        type: null, // gets filled in by defineEntSchema
        inverse: true,
      });
    }
    return this;
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
        }
      | { type: "ref"; ref: string }
    ))
  | ({
      cardinality: "multiple";
    } & (
      | { type: "field"; ref: string }
      | {
          type: "ref";
          table: string;
          field: string;
          ref: string;
          inverse: boolean;
        }
    ))
);

type EdgeConfigFromEntDefinition = {
  name: string;
  to: string;
} & (
  | ({
      cardinality: "single";
    } & (
      | {
          type: "field";
          field: string;
        }
      | { type: "ref"; ref: null | string }
    ))
  | ({
      cardinality: "multiple";
    } & (
      | { type: null; inverse?: true }
      | { type: "field"; ref: string }
      | {
          type: "ref";
          table: string;
          field: string;
          ref: string;
          inverse?: true;
        }
    ))
);

type ExtractDocument<T extends Validator<any, any, any>> =
  // Add the system fields to `Value` (except `_id` because it depends on
  //the table name) and trick TypeScript into expanding them.
  Expand<SystemFields & T["type"]>;

export type Expand<ObjectType extends Record<any, any>> =
  ObjectType extends Record<any, any>
    ? {
        [Key in keyof ObjectType]: ObjectType[Key];
      }
    : never;
type ExtractFieldPaths<T extends Validator<any, any, any>> =
  // Add in the system fields available in index definitions.
  // This should be everything except for `_id` because thats added to indexes
  // automatically.
  T["fieldPaths"] | keyof SystemFields;
export type SystemFields = {
  _creationTime: number;
};

type ObjectValidator<Validators extends PropertyValidators> = Validator<
  // Compute the TypeScript type this validator refers to.
  ObjectType<Validators>,
  false,
  // Compute the field paths for this validator. For every property in the object,
  // add on a field path for that property and extend all the field paths in the
  // validator.
  {
    [Property in keyof Validators]:
      | JoinFieldPaths<Property & string, Validators[Property]["fieldPaths"]>
      | Property;
  }[keyof Validators] &
    string
>;

type JoinFieldPaths<
  Start extends string,
  End extends string
> = `${Start}.${End}`;

export type GenericEntsDataModel<DataModel extends GenericDataModel> = Record<
  TableNamesInDataModel<DataModel>,
  GenericEntModel<DataModel>
>;

export type GenericEntModel<DataModel extends GenericDataModel> = {
  edges: Record<string, GenericEdgeConfig<DataModel>>;
};

export type EntDataModelFromSchema<
  SchemaDef extends SchemaDefinition<any, boolean>
> = {
  [TableName in keyof SchemaDef["tables"] &
    string]: SchemaDef["tables"][TableName] extends EntDefinition<
    any,
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

export function getEntDefinition(tables: GenericSchema): any {
  return Object.keys(tables).reduce(
    (acc, tableName) => ({
      ...acc,
      [tableName]: {
        edges: (tables[tableName] as any).edgeConfigs,
      },
    }),
    {}
  ) as any;
}
