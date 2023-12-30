// OPTIONAL: Rename this file to `schema.ts` to declare the shape
// of the data in your database.
// See https://docs.convex.dev/database/schemas.

import {
  defineSchema,
  defineTable as baseDefineTable,
  TableDefinition,
  GenericDocument,
  GenericTableIndexes,
  GenericTableSearchIndexes,
  GenericTableVectorIndexes,
  FieldPaths,
} from "convex/server";
import {
  ObjectType,
  PropertyValidators,
  Validator,
  v as baseV,
} from "convex/values";

function defineEnt<
  DocumentSchema extends Record<
    string,
    Validator<any, any, any> | EdgeValidator<any, any, any>
  >
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

interface EntDefinition<
  Document extends GenericDocument = GenericDocument,
  FieldPaths extends string = string,
  // eslint-disable-next-line @typescript-eslint/ban-types
  Indexes extends GenericTableIndexes = {},
  // eslint-disable-next-line @typescript-eslint/ban-types
  SearchIndexes extends GenericTableSearchIndexes = {},
  // eslint-disable-next-line @typescript-eslint/ban-types
  VectorIndexes extends GenericTableVectorIndexes = {}
> extends TableDefinition<
    Document,
    FieldPaths,
    Indexes,
    SearchIndexes,
    VectorIndexes
  > {
  edge(table: string, options?: EdgeOptions): this;
  edges(table: string, options?: EdgesOptions): this;
}

type EdgeOptions = {
  name: string;
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

  constructor(documentType: Validator<any, any, any>) {
    this.indexes = [];
    this.searchIndexes = [];
    this.vectorIndexes = [];
    this.documentType = documentType;
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
      documentType: this.documentType.json,
    };
  }

  edge(table: string, options?: EdgeOptions): this {
    return this;
  }

  edges(table: string, options?: EdgesOptions): this {
    return this;
  }
}

type ConvertEdges<
  DocumentSchema extends Record<
    string,
    Validator<any, any, any> | EdgeValidator<any, any, any>
  >
> = {
  [Key in keyof DocumentSchema as Key extends string
    ? DocumentSchema[Key] extends EdgeValidator<any, any, any>
      ? `${Key}Id`
      : Key
    : never]: DocumentSchema[Key];
};

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

const v = {
  ...baseV,
  edge: (tableName: string) => new EdgeValidator(v.id(tableName)),
};

class EdgeValidator<T, I extends boolean, P extends string> extends Validator<
  T,
  I,
  P
> {
  constructor(
    public validator: Validator<T, I, P>,
    private isIndexed: boolean = false
  ) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    super(validator.json, validator.isOptional);
  }

  indexed(): EdgeValidator<T, I, P> {
    return new EdgeValidator(this.validator, true);
  }
}

export default defineSchema(
  {
    // messages: defineTable({
    //   text: v.string(),
    //   authorId: v.id("users"),
    // }).index("authorId", ["authorId"]),
    messages: defineEnt({
      text: v.string(),
    }).edge("users", { name: "author" }),
    // .edges("tags"),

    users: defineEnt({}).edges("messages"),
    // .edges("followees", "users", { inverse: "followers" })
    // .edges("friends", "users"),

    tags: defineEnt({
      name: v.string(),
    }),
    //.edges("messages"),

    documents: defineEnt({
      fieldOne: v.string(),
      fieldTwo: v.object({
        subFieldOne: v.array(v.number()),
      }),
    }),
    // This definition matches the example query and mutation code:
    numbers: defineEnt({
      value: v.number(),
    }),
  },
  // If you ever get an error about schema mismatch
  // between your data and your schema, and you cannot
  // change the schema to match the current data in your database,
  // you can:
  //  1. Use the dashboard to delete tables or individual documents
  //     that are causing the error.
  //  2. Change this option to `false` and make changes to the data
  //     freely, ignoring the schema. Don't forget to change back to `true`!
  { schemaValidation: false }
);
