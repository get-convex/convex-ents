import {
  DocumentByName,
  FieldTypeFromFieldPath,
  GenericDatabaseReader,
  GenericDataModel,
  NamedTableInfo,
  QueryInitializer,
  SystemDataModel,
  SystemTableNames,
  TableNamesInDataModel,
} from "convex/server";
import { EdgeConfig, GenericEdgeConfig, GenericEntsDataModel } from "./schema";
import { GenericId } from "convex/values";

export type EntsSystemDataModel = {
  [key in keyof SystemDataModel]: SystemDataModel[key] & {
    edges: Record<string, never>;
  };
};

export type PromiseEdgeResult<
  EdgeConfig extends GenericEdgeConfig,
  MultipleRef,
  MultipleField,
  SingleOptional,
  Single,
> = EdgeConfig["cardinality"] extends "multiple"
  ? EdgeConfig["type"] extends "ref"
    ? MultipleRef
    : MultipleField
  : EdgeConfig["type"] extends "ref"
    ? SingleOptional
    : EdgeConfig["optional"] extends true
      ? SingleOptional
      : Single;

export type IndexFieldTypesForEq<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
  T extends string[],
> = PopIfSeveral<{
  [K in keyof T]: FieldTypeFromFieldPath<
    DocumentByName<EntsDataModel, Table>,
    T[K]
  >;
}>;

// System indexes have only a single field, so we won't to perform
// equality check on that field. Normal indexes always have _creationTime as the last field.
type PopIfSeveral<T extends any[]> = T extends [infer Only]
  ? [Only]
  : T extends [...infer Rest, infer _Last]
    ? Rest
    : never;

export function getEdgeDefinitions<
  EntsDataModel extends GenericEntsDataModel,
  Table extends TableNamesInDataModel<EntsDataModel>,
>(entDefinitions: EntsDataModel, table: Table) {
  return entDefinitions[table].edges as Record<
    keyof EntsDataModel[Table]["edges"],
    EdgeConfig
  >;
}

export type UniqueIndexFieldName<T extends string[]> = T extends [infer Only]
  ? Only
  : T extends [infer Single, "_creationTime"]
    ? Single
    : never;

export function systemAwareGet<
  DataModel extends GenericDataModel,
  Table extends TableNamesInDataModel<DataModel>,
>(db: GenericDatabaseReader<DataModel>, table: Table, id: GenericId<Table>) {
  return isSystemTable(table)
    ? db.system.get(table, id as any)
    : db.get(table, id);
}

export function systemAwareQuery<
  DataModel extends GenericDataModel,
  Table extends TableNamesInDataModel<DataModel>,
>(
  db: GenericDatabaseReader<DataModel>,
  table: Table,
): QueryInitializer<NamedTableInfo<DataModel, Table>> {
  return isSystemTable(table)
    ? (db.system.query(table) as any)
    : db.query(table);
}

export function isSystemTable(table: string): table is SystemTableNames {
  return table.startsWith("_");
}
