import { GenericEnt, GenericEntWriter } from "../../src";
import { DataModel, TableNames } from "./_generated/dataModel";
import { entDefinitions } from "./schema";

export type Ent<TableName extends TableNames> = GenericEnt<
  DataModel,
  typeof entDefinitions,
  TableName
>;
export type EntWriter<TableName extends TableNames> = GenericEntWriter<
  DataModel,
  typeof entDefinitions,
  TableName
>;
