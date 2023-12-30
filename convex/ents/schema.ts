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
import { ObjectType, PropertyValidators, Validator, v } from "convex/values";

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
  for (let i = 0; i < tableNames.length; i++) {
    const tableName = tableNames[i];
    const table = schema[tableName];
    for (const edge of (table as any)
      .edgeConfigs as EdgeConfigFromEntDefinition[]) {
      if (edge.cardinality === "multiple") {
        const otherTableName = edge.to;
        const otherTable = schema[otherTableName];
        if (otherTable === undefined) {
          continue;
        }
        if (tableNames.indexOf(otherTableName) < i) {
          // We handled this pair already
          continue;
        }
        for (const inverseEdge of (otherTable as any)
          .edgeConfigs as EdgeConfigFromEntDefinition[]) {
          if (inverseEdge.to !== tableName) {
            continue;
          }
          if (inverseEdge.cardinality === "single") {
            if (inverseEdge.type === "ref") {
              throw new Error(
                "Unexpected optional edge for " +
                  edge.name +
                  " called " +
                  inverseEdge.name
              );
            }
            edge.type = "field";
            (edge as any).ref = inverseEdge.field;
          }

          if (inverseEdge.cardinality === "multiple") {
            const edgeTableName = `${tableName}_to_${otherTableName}`;
            // Add the table
            (schema as any)[edgeTableName] = defineEnt({
              [tableName + "Id"]: v.id(tableName),
              [otherTableName + "Id"]: v.id(otherTableName),
            })
              .index(tableName + "Id", [tableName + "Id"])
              .index(otherTableName + "Id", [otherTableName + "Id"]);
            edge.type = "ref";
            (edge as any).table = edgeTableName;
            (edge as any).field = tableName + "Id";
            (edge as any).ref = otherTableName + "Id";
            inverseEdge.type = "ref";
            (inverseEdge as any).table = edgeTableName;
            (inverseEdge as any).field = otherTableName + "Id";
            (inverseEdge as any).ref = tableName + "Id";

            // TODO: Error on repeated iteration before the if block instead of breaking
            break;
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
  if (documentSchema instanceof Validator) {
    return new EntDefinitionImpl(documentSchema) as any;
  } else {
    return new EntDefinitionImpl(v.object(documentSchema)) as any;
  }
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
  edge<EdgeName extends string>(
    edge: EdgeName
  ): EntDefinition<
    Document & { [key in `${EdgeName}Id`]: string },
    FieldPaths | `${EdgeName}Id`,
    Indexes,
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
  edges(table: string, options: EdgesOptions): this;
}

type EdgeOptions = {
  optional?: true;
};

type EdgesOptions = {
  name: string;
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
  // The type of documents stored in this table.
  private documentType: Validator<any, any, any>;

  private edgeConfigs: EdgeConfigFromEntDefinition[];

  constructor(documentType: Validator<any, any, any>) {
    this.indexes = [];
    this.searchIndexes = [];
    this.vectorIndexes = [];
    this.documentType = documentType;
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
      documentType: (this.documentType as any).json,
    };
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

  edges(table: string, options?: EdgesOptions): this {
    if (options === undefined) {
      this.edgeConfigs.push({
        name: table,
        to: table,
        cardinality: "multiple",
        type: null, // gets filled in by defineEntSchema
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
      | { type: "ref"; table: string; field: string; ref: string }
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
      | { type: null }
      | { type: "field"; ref: string }
      | { type: "ref"; table: string; field: string; ref: string }
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
