import {
  DocumentByName,
  GenericDataModel,
  GenericMutationCtx,
  TableNamesInDataModel,
  WithOptionalSystemFields,
  WithoutSystemFields,
} from "convex/server";
import { PromiseTable, PromiseTableImpl } from "./functions";
import { GenericEntsDataModel } from "./schema";
import { GenericId } from "convex/values";

export interface TableWriter<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends PromiseTable<DataModel, EntsDataModel, Table> {
  /**
   * Insert a new document into a table.
   *
   * @param table - The name of the table to insert a new document into.
   * @param value - The {@link values.Value} to insert into the given table.
   * @returns - {@link values.GenericId} of the new document.
   */
  // TODO: Chain methods to get the written document?
  insert(
    value: WithoutSystemFields<
      WithDefaultedOptional<
        DocumentByName<DataModel, Table>,
        EntsDataModel[Table]["defaultedFields"]
      >
    >
  ): Promise<GenericId<Table>>;

  /**
   * Patch an existing document, shallow merging it with the given partial
   * document.
   *
   * New fields are added. Existing fields are overwritten. Fields set to
   * `undefined` are removed.
   *
   * @param id - The {@link values.GenericId} of the document to patch.
   * @param value - The partial {@link GenericDocument} to merge into the specified document. If this new value
   * specifies system fields like `_id`, they must match the document's existing field values.
   */
  patch(
    id: GenericId<Table>,
    value: Partial<DocumentByName<DataModel, Table>>
  ): Promise<void>;

  /**
   * Replace the value of an existing document, overwriting its old value.
   *
   * @param id - The {@link values.GenericId} of the document to replace.
   * @param value - The new {@link GenericDocument} for the document. This value can omit the system fields,
   * and the database will fill them in.
   */
  replace(
    id: GenericId<Table>,
    value: WithOptionalSystemFields<
      WithDefaultedOptional<
        DocumentByName<DataModel, Table>,
        EntsDataModel[Table]["defaultedFields"]
      >
    >
  ): Promise<void>;

  /**
   * Delete an existing document.
   *
   * @param id - The {@link values.GenericId} of the document to remove.
   */
  delete(id: GenericId<TableNamesInDataModel<DataModel>>): Promise<void>;
}

export class TableWriterImpl<
  DataModel extends GenericDataModel,
  EntsDataModel extends GenericEntsDataModel<DataModel>,
  Table extends TableNamesInDataModel<DataModel>
> extends PromiseTableImpl<DataModel, EntsDataModel, Table> {
  protected ctx: GenericMutationCtx<DataModel>;

  constructor(
    ctx: GenericMutationCtx<DataModel>,
    entDefinitions: EntsDataModel,
    table: Table
  ) {
    super(ctx, entDefinitions, table);
    this.ctx = ctx;
  }

  insert(value: WithoutSystemFields<DocumentByName<DataModel, Table>>) {
    return this.ctx.db.insert(this.table, value);
  }

  /**
   * Patch an existing document, shallow merging it with the given partial
   * document.
   *
   * New fields are added. Existing fields are overwritten. Fields set to
   * `undefined` are removed.
   *
   * @param id - The {@link values.GenericId} of the document to patch.
   * @param value - The partial {@link GenericDocument} to merge into the specified document. If this new value
   * specifies system fields like `_id`, they must match the document's existing field values.
   */
  patch(
    id: GenericId<Table>,
    value: Partial<DocumentByName<DataModel, Table>>
  ) {
    return this.ctx.db.patch(id, value);
  }

  /**
   * Replace the value of an existing document, overwriting its old value.
   *
   * @param id - The {@link values.GenericId} of the document to replace.
   * @param value - The new {@link GenericDocument} for the document. This value can omit the system fields,
   * and the database will fill them in.
   */
  replace(
    id: GenericId<Table>,
    value: WithOptionalSystemFields<DocumentByName<DataModel, Table>>
  ) {
    return this.ctx.db.replace(id, value);
  }

  /**
   * Delete an existing document.
   *
   * @param id - The {@link values.GenericId} of the document to remove.
   */
  delete(id: GenericId<TableNamesInDataModel<DataModel>>) {
    return this.ctx.db.delete(id);
  }
}

type WithDefaultedOptional<
  Document extends Record<string, any>,
  DefaultedFields extends string
> = Omit<Document, DefaultedFields> & {
  [key in DefaultedFields]?: Document[key];
};
