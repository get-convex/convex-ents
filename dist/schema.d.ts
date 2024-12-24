import { DefineSchemaOptions, SchemaDefinition, GenericTableIndexes, GenericTableSearchIndexes, GenericTableVectorIndexes, TableDefinition, SearchIndexConfig, VectorIndexConfig, GenericDataModel, DataModelFromSchemaDefinition } from 'convex/server';
import { PropertyValidators, GenericValidator, Validator, VId, GenericId, VOptional, VFloat64, VObject, ObjectType, VAny } from 'convex/values';

declare function defineEntSchema<Schema extends Record<string, EntDefinition>, StrictTableNameTypes extends boolean = true>(schema: Schema, options?: DefineSchemaOptions<StrictTableNameTypes>): SchemaDefinition<Schema, StrictTableNameTypes>;
declare function edgeCompoundIndexName(edgeDefinition: EdgeConfig & {
    cardinality: "multiple";
    type: "ref";
}): string;
declare function defineEnt<DocumentSchema extends PropertyValidators>(documentSchema: DocumentSchema): EntDefinition<ObjectValidator<DocumentSchema>>;
declare function defineEntFromTable<DocumentType extends GenericValidator = GenericValidator, Indexes extends GenericTableIndexes = Record<string, never>, SearchIndexes extends GenericTableSearchIndexes = Record<string, never>, VectorIndexes extends GenericTableVectorIndexes = Record<string, never>>(definition: TableDefinition<DocumentType, Indexes, SearchIndexes, VectorIndexes>): EntDefinition<DocumentType, Indexes, SearchIndexes, VectorIndexes>;
type DefineEntFromTables<T extends {
    [key: string]: TableDefinition<any, any, any, any>;
}> = {
    [K in keyof T]: T[K] extends TableDefinition<infer D, infer I, infer S, infer V> ? EntDefinition<D, I, S, V> : never;
};
declare function defineEntsFromTables<T extends {
    [key: string]: TableDefinition<any, any, any, any>;
}>(definitions: T): DefineEntFromTables<T>;
type GenericEdges = Record<string, GenericEdgeConfig>;
type GenericEdgeConfig = {
    name: string;
    to: string;
    cardinality: "single" | "multiple";
    type: "field" | "ref";
    optional?: boolean;
};
type ExtractFieldPaths<T extends Validator<any, any, any>> = T["fieldPaths"] | keyof SystemFields;
type ObjectFieldType<FieldName extends string, T extends Validator<any, any, any>> = T["isOptional"] extends "optional" ? {
    [key in FieldName]?: T["type"];
} : {
    [key in FieldName]: T["type"];
};
type AddField<V extends GenericValidator, FieldName extends string, P extends GenericValidator> = V extends VObject<infer TypeScriptType, infer Fields, infer IsOptional, infer FieldPaths> ? VObject<Expand<TypeScriptType & ObjectFieldType<FieldName, P>>, Expand<Fields & {
    FieldName: P;
}>, IsOptional, FieldPaths | FieldName> : V extends VAny ? VAny : never;
interface EntDefinition<DocumentType extends Validator<any, any, any> = Validator<any, any, any>, Indexes extends GenericTableIndexes = {}, SearchIndexes extends GenericTableSearchIndexes = {}, VectorIndexes extends GenericTableVectorIndexes = {}, Edges extends GenericEdges = {}> extends TableDefinition<DocumentType, Indexes, SearchIndexes, VectorIndexes> {
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
    index<IndexName extends string, FirstFieldPath extends ExtractFieldPaths<DocumentType>, RestFieldPaths extends ExtractFieldPaths<DocumentType>[]>(name: IndexName, fields: [FirstFieldPath, ...RestFieldPaths]): EntDefinition<DocumentType, Expand<Indexes & Record<IndexName, [FirstFieldPath, ...RestFieldPaths, "_creationTime"]>>, SearchIndexes, VectorIndexes, Edges>;
    fieldOptions<FieldName extends string, T extends GenericValidator>(field: FieldName, validator: T): EntDefinition<AddField<DocumentType, FieldName, T>, Indexes, SearchIndexes, VectorIndexes, Edges>;
    fieldOptions<FieldName extends string, T extends Validator<any, any, any>>(field: FieldName, validator: T, options: {
        index: true;
    }): EntDefinition<AddField<DocumentType, FieldName, T>, Indexes & {
        [key in FieldName]: [FieldName, "_creationTime"];
    }, SearchIndexes, VectorIndexes, Edges>;
    fieldOptions<FieldName extends string, T extends Validator<any, any, any>>(field: FieldName, validator: T, options: {
        unique: true;
    }): EntDefinition<AddField<DocumentType, FieldName, T>, Indexes & {
        [key in FieldName]: [FieldName, "_creationTime"];
    }, SearchIndexes, VectorIndexes, Edges>;
    fieldOptions<FieldName extends string, T extends Validator<any, "required", any>>(field: FieldName, validator: T, options: {
        default: T["type"];
    }): EntDefinition<AddField<DocumentType, FieldName, T>, Indexes, SearchIndexes, VectorIndexes, Edges>;
    /**
     * Define a search index on this table.
     *
     * To learn about search indexes, see [Search](https://docs.convex.dev/text-search).
     *
     * @param name - The name of the index.
     * @param indexConfig - The search index configuration object.
     * @returns A {@link TableDefinition} with this search index included.
     */
    searchIndex<IndexName extends string, SearchField extends ExtractFieldPaths<DocumentType>, FilterFields extends ExtractFieldPaths<DocumentType> = never>(name: IndexName, indexConfig: Expand<SearchIndexConfig<SearchField, FilterFields>>): EntDefinition<DocumentType, Indexes, Expand<SearchIndexes & Record<IndexName, {
        searchField: SearchField;
        filterFields: FilterFields;
    }>>, VectorIndexes, Edges>;
    vectorIndex<IndexName extends string, VectorField extends ExtractFieldPaths<DocumentType>, FilterFields extends ExtractFieldPaths<DocumentType> = never>(name: IndexName, indexConfig: Expand<VectorIndexConfig<VectorField, FilterFields>>): EntDefinition<DocumentType, Indexes, SearchIndexes, Expand<VectorIndexes & Record<IndexName, {
        vectorField: VectorField;
        dimensions: number;
        filterFields: FilterFields;
    }>>, Edges>;
    field<FieldName extends string, T extends GenericValidator>(field: FieldName, validator: T): EntDefinition<AddField<DocumentType, FieldName, T>, Indexes, SearchIndexes, VectorIndexes, Edges>;
    field<FieldName extends string, T extends Validator<any, any, any>>(field: FieldName, validator: T, options: {
        index: true;
    }): EntDefinition<AddField<DocumentType, FieldName, T>, Indexes & {
        [key in FieldName]: [FieldName, "_creationTime"];
    }, SearchIndexes, VectorIndexes, Edges>;
    field<FieldName extends string, T extends Validator<any, any, any>>(field: FieldName, validator: T, options: {
        unique: true;
    }): EntDefinition<AddField<DocumentType, FieldName, T>, Indexes & {
        [key in FieldName]: [FieldName, "_creationTime"];
    }, SearchIndexes, VectorIndexes, Edges>;
    field<FieldName extends string, T extends Validator<any, "required", any>>(field: FieldName, validator: T, options: {
        default: T["type"];
    }): EntDefinition<AddField<DocumentType, FieldName, T>, Indexes, SearchIndexes, VectorIndexes, Edges>;
    edge<EdgeName extends string>(edge: EdgeName, options?: {
        deletion: "hard" | "soft";
    }): EntDefinition<AddField<DocumentType, `${EdgeName}Id`, VId<GenericId<`${EdgeName}s`>>>, Indexes & {
        [key in `${EdgeName}Id`]: [`${EdgeName}Id`, "_creationTime"];
    }, SearchIndexes, VectorIndexes, Edges & {
        [key in EdgeName]: {
            name: EdgeName;
            to: `${EdgeName}s`;
            type: "field";
            cardinality: "single";
            optional: false;
        };
    }>;
    edge<EdgeName extends string, const FieldName extends string>(edge: EdgeName, options: {
        field: FieldName;
        deletion?: "hard" | "soft";
    }): EntDefinition<AddField<DocumentType, NoInfer<FieldName>, VId<GenericId<`${EdgeName}s`>>>, Indexes & {
        [key in NoInfer<FieldName>]: [NoInfer<FieldName>, "_creationTime"];
    }, SearchIndexes, VectorIndexes, Edges & {
        [key in EdgeName]: {
            name: EdgeName;
            to: `${EdgeName}s`;
            type: "field";
            cardinality: "single";
            optional: false;
        };
    }>;
    edge<EdgeName extends string, const FieldName extends string>(edge: EdgeName, options: {
        field: FieldName;
        optional: true;
        deletion?: "hard" | "soft";
    }): EntDefinition<AddField<DocumentType, NoInfer<FieldName>, VOptional<VId<GenericId<`${EdgeName}s`>>>>, Indexes & {
        [key in NoInfer<FieldName>]: [NoInfer<FieldName>, "_creationTime"];
    }, SearchIndexes, VectorIndexes, Edges & {
        [key in EdgeName]: {
            name: EdgeName;
            to: `${EdgeName}s`;
            type: "field";
            cardinality: "single";
            optional: true;
        };
    }>;
    edge<EdgeName extends string, const FieldName extends string, const ToTable extends string>(edge: EdgeName, options: {
        field: FieldName;
        to: ToTable;
        deletion?: ToTable extends "_storage" | "_scheduled_functions" ? "hard" : "hard" | "soft";
    }): EntDefinition<AddField<DocumentType, NoInfer<FieldName>, VId<GenericId<`${ToTable}`>>>, Indexes & {
        [key in NoInfer<FieldName>]: [NoInfer<FieldName>, "_creationTime"];
    }, SearchIndexes, VectorIndexes, Edges & {
        [key in EdgeName]: {
            name: EdgeName;
            to: ToTable;
            type: "field";
            cardinality: "single";
            optional: false;
        };
    }>;
    edge<EdgeName extends string, const ToTable extends string>(edge: EdgeName, options: {
        to: ToTable;
        deletion?: ToTable extends "_storage" | "_scheduled_functions" ? "hard" : "hard" | "soft";
    }): EntDefinition<AddField<DocumentType, `${EdgeName}Id`, VId<GenericId<`${ToTable}`>>>, Indexes & {
        [key in `${EdgeName}Id`]: [`${EdgeName}Id`, "_creationTime"];
    }, SearchIndexes, VectorIndexes, Edges & {
        [key in EdgeName]: {
            name: EdgeName;
            to: ToTable;
            type: "field";
            cardinality: "single";
            optional: false;
        };
    }>;
    edge<EdgeName extends string, const FieldName extends string, const ToTable extends string>(edge: EdgeName, options: {
        field: FieldName;
        to: ToTable;
        optional: true;
        deletion?: ToTable extends "_storage" | "_scheduled_functions" ? "hard" : "hard" | "soft";
    }): EntDefinition<AddField<DocumentType, NoInfer<FieldName>, VOptional<VId<GenericId<ToTable>>>>, Indexes & {
        [key in NoInfer<FieldName>]: [NoInfer<FieldName>, "_creationTime"];
    }, SearchIndexes, VectorIndexes, Edges & {
        [key in EdgeName]: {
            name: EdgeName;
            to: ToTable;
            type: "field";
            cardinality: "single";
            optional: true;
        };
    }>;
    edge<EdgeName extends string>(edge: EdgeName, options: {
        ref: true | string;
        deletion?: "soft";
    }): EntDefinition<DocumentType, Indexes, SearchIndexes, VectorIndexes, Edges & {
        [key in EdgeName]: {
            name: EdgeName;
            to: `${EdgeName}s`;
            type: "ref";
            cardinality: "single";
        };
    }>;
    edge<EdgeName extends string, const ToTable extends string>(edge: EdgeName, options: {
        to: ToTable;
        ref: true | string;
        deletion?: "soft";
    }): EntDefinition<DocumentType, Indexes, SearchIndexes, VectorIndexes, Edges & {
        [key in EdgeName]: {
            name: EdgeName;
            to: NoInfer<ToTable>;
            type: "ref";
            cardinality: "single";
        };
    }>;
    /**
     * Define many:1 edge to another table.
     * @param edge The name of the edge, also the name of the target table.
     * @param options.ref The name of the field that stores the many:1 edge
     *   on the other table, or `true` to infer it.
     */
    edges<EdgesName extends string>(edge: EdgesName, options: {
        ref: true | string;
        deletion?: "soft";
    }): EntDefinition<DocumentType, Indexes, SearchIndexes, VectorIndexes, Edges & {
        [key in EdgesName]: {
            name: EdgesName;
            to: EdgesName;
            type: "field";
            cardinality: "multiple";
        };
    }>;
    /**
     * Define many:1 edge to another table.
     * @param edge The name of the edge.
     * @param options.to Name of the table the edge points to.
     *   If it's the same as the table this edge is defined on, this edge is
     *   a symmetric, self-directed many:many edge.
     * @param options.ref The name of the field that stores the many:1 edge
     *   on the other table, or `true` to infer it.
     */
    edges<EdgesName extends string, TableName extends string>(edge: EdgesName, options: {
        to: TableName;
        ref: true | string;
        deletion?: "soft";
    }): EntDefinition<DocumentType, Indexes, SearchIndexes, VectorIndexes, Edges & {
        [key in EdgesName]: {
            name: EdgesName;
            to: NoInfer<TableName>;
            type: "field";
            cardinality: "multiple";
        };
    }>;
    /**
     * Define many:many edge to another table.
     * @param edge The name of the edge, also the name of the target table.
     * @param options.table Optional, name of the table to store the many:many edge in.
     * @param options.field Optional, name of the field to store the ID of the
     *   this end of the many:many edge.
     */
    edges<EdgesName extends string>(edge: EdgesName, options?: {
        table?: string;
        field?: string;
    }): EntDefinition<DocumentType, Indexes, SearchIndexes, VectorIndexes, Edges & {
        [key in EdgesName]: {
            name: EdgesName;
            to: EdgesName;
            type: "ref";
            cardinality: "multiple";
        };
    }>;
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
    edges<EdgesName extends string, TableName extends string>(edge: EdgesName, options: {
        to: TableName;
        table?: string;
        field?: string;
        inverseField?: string;
    }): EntDefinition<DocumentType, Indexes, SearchIndexes, VectorIndexes, Edges & {
        [key in EdgesName]: {
            name: EdgesName;
            to: NoInfer<TableName>;
            type: "ref";
            cardinality: "multiple";
        };
    }>;
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
    edges<EdgesName extends string, TableName extends string, InverseEdgesNames extends string>(edge: EdgesName, options: {
        to: TableName;
        inverse: InverseEdgesNames;
        table?: string;
        field?: string;
        inverseField?: string;
    }): EntDefinition<DocumentType, Indexes, SearchIndexes, VectorIndexes, Edges & {
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
    }>;
    /**
     * Add the "soft"  deletion behavior to this ent.
     *
     * When the ent is "soft" deleted, its `deletionTime` field is set to the
     * current time and it is not actually deleted.
     *
     * @param type `"soft"`
     */
    deletion(type: "soft"): EntDefinition<AddField<DocumentType, "deletionTime", VOptional<VFloat64>>, Indexes, SearchIndexes, VectorIndexes, Edges>;
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
    deletion(type: "scheduled", options?: {
        delayMs: number;
    }): EntDefinition<AddField<DocumentType, "deletionTime", VOptional<VFloat64>>, Indexes, SearchIndexes, VectorIndexes, Edges>;
}
type NoInfer<T> = [T][T extends any ? 0 : never];
type EdgeConfig = {
    name: string;
    to: string;
} & (({
    cardinality: "single";
} & ({
    type: "field";
    field: string;
    unique: boolean;
    optional: boolean;
    deletion?: "soft" | "hard";
} | {
    type: "ref";
    ref: string;
    deletion?: "soft";
})) | ({
    cardinality: "multiple";
} & ({
    type: "field";
    ref: string;
    deletion?: "soft";
} | {
    type: "ref";
    table: string;
    field: string;
    ref: string;
    inverse: boolean;
    symmetric: boolean;
})));
type FieldConfig = {
    name: string;
    unique: boolean;
};
type Expand<ObjectType extends Record<any, any>> = ObjectType extends Record<any, any> ? {
    [Key in keyof ObjectType]: ObjectType[Key];
} : never;
type SystemFields = {
    _creationTime: number;
};
type ObjectValidator<Validators extends PropertyValidators> = VObject<ObjectType<Validators>, Validators>;
type GenericEntsDataModel = GenericDataModel & Record<string, GenericEntModel>;
type GenericEntModel = {
    edges: Record<string, GenericEdgeConfig>;
};
type DeletionConfig = {
    type: "soft";
} | {
    type: "scheduled";
    delayMs?: number;
};
type EntDataModelFromSchema<SchemaDef extends SchemaDefinition<any, boolean>> = DataModelFromSchemaDefinition<SchemaDef> & {
    [TableName in keyof SchemaDef["tables"] & string]: SchemaDef["tables"][TableName] extends EntDefinition<any, any, any, any, infer Edges> ? {
        edges: Edges;
    } : never;
};
declare function getEntDefinitions<SchemaDef extends SchemaDefinition<any, boolean>>(schema: SchemaDef): EntDataModelFromSchema<typeof schema>;

export { type DeletionConfig, type EdgeConfig, type EntDataModelFromSchema, type EntDefinition, type Expand, type FieldConfig, type GenericEdgeConfig, type GenericEntModel, type GenericEntsDataModel, type SystemFields, defineEnt, defineEntFromTable, defineEntSchema, defineEntsFromTables, edgeCompoundIndexName, getEntDefinitions };
