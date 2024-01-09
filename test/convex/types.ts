import { CustomCtx } from "convex-helpers/server/customFunctions";
import { GenericEnt, GenericEntWriter } from "../../src";
import { DataModel, TableNames } from "./_generated/dataModel";
import { mutation, query } from "./functions";
import { entDefinitions } from "./schema";

export type QueryCtx = CustomCtx<typeof query>;
export type MutationCtx = CustomCtx<typeof mutation>;

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
