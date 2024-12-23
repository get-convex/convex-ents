import { SystemDataModel, TableNamesInDataModel, FieldTypeFromFieldPath, DocumentByName } from 'convex/server';
import { GenericEdgeConfig, GenericEntsDataModel, EdgeConfig } from './schema.js';
import 'convex/values';

type EntsSystemDataModel = {
    [key in keyof SystemDataModel]: SystemDataModel[key] & {
        edges: Record<string, never>;
    };
};
type PromiseEdgeResult<EdgeConfig extends GenericEdgeConfig, MultipleRef, MultipleField, SingleOptional, Single> = EdgeConfig["cardinality"] extends "multiple" ? EdgeConfig["type"] extends "ref" ? MultipleRef : MultipleField : EdgeConfig["type"] extends "ref" ? SingleOptional : EdgeConfig["optional"] extends true ? SingleOptional : Single;
type IndexFieldTypesForEq<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>, T extends string[]> = Pop<{
    [K in keyof T]: FieldTypeFromFieldPath<DocumentByName<EntsDataModel, Table>, T[K]>;
}>;
type Pop<T extends any[]> = T extends [...infer Rest, infer _Last] ? Rest : never;
declare function getEdgeDefinitions<EntsDataModel extends GenericEntsDataModel, Table extends TableNamesInDataModel<EntsDataModel>>(entDefinitions: EntsDataModel, table: Table): Record<keyof EntsDataModel[Table]["edges"], EdgeConfig>;

export { type EntsSystemDataModel, type IndexFieldTypesForEq, type PromiseEdgeResult, getEdgeDefinitions };
