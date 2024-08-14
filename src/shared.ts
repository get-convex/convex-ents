import {
  DocumentByName,
  FieldTypeFromFieldPath,
  SystemDataModel,
  TableNamesInDataModel,
} from "convex/server";
import { EdgeConfig, GenericEdgeConfig, GenericEntsDataModel } from "./schema";

export type EntsSystemDataModel = {
  [key in keyof SystemDataModel]: SystemDataModel[key] & {
    edges: Record<string, never>;
  };
};

export type PromiseEdgeResult<
  EdgeConfig extends GenericEdgeConfig,
  MultipleRef,
  MultipleField,
  SingleRef,
  SingleField,
> = EdgeConfig["cardinality"] extends "multiple"
  ? EdgeConfig["type"] extends "ref"
    ? MultipleRef
    : MultipleField
  : EdgeConfig["type"] extends "ref"
    ? SingleRef
    : SingleField;

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
