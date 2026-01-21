import {
  DocumentByName,
  FieldTypeFromFieldPath,
  GenericDatabaseReader,
  GenericDataModel,
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
> = Pop<{
  [K in keyof T]: FieldTypeFromFieldPath<
    DocumentByName<EntsDataModel, Table>,
    T[K]
  >;
}>;

type Pop<T extends any[]> = T extends [...infer Rest, infer _Last]
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
export function isSystemTable(table: string): table is SystemTableNames {
  return table.startsWith("_");
}

export function systemAwareGet<DataModel extends GenericDataModel, Table extends TableNamesInDataModel<DataModel>>(db: GenericDatabaseReader<DataModel>, table: Table, id: GenericId<Table>) {
  return isSystemTable(table)
    ? db.system.get(table, id as any)
    : db.get(table, id);
}
// TODO: make more queries system-aware
// export function systemAwareQuery<DataModel extends GenericDataModel, Table extends TableNamesInDataModel<DataModel>>(db: GenericDatabaseReader<DataModel>, table: Table): QueryInitializer<NamedTableInfo<DataModel, Table>> {
//   return isSystemTable(table)
//     ? db.system.query(table) as any
//     : db.query(table);
// }
