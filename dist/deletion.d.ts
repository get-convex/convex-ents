import * as convex_values from 'convex/values';
import { Infer } from 'convex/values';
import { FunctionReference, RegisteredMutation } from 'convex/server';
import { GenericEntsDataModel } from './schema.js';

type ScheduledDeleteFuncRef = FunctionReference<"mutation", "internal", {
    origin: Origin;
    stack: Stack;
    inProgress: boolean;
}, void>;
type Origin = {
    id: string;
    table: string;
    deletionTime: number;
};
declare const vApproach: convex_values.VUnion<"cascade" | "paginate", [convex_values.VLiteral<"cascade", "required">, convex_values.VLiteral<"paginate", "required">], "required", never>;
type Approach = Infer<typeof vApproach>;
declare function scheduledDeleteFactory<EntsDataModel extends GenericEntsDataModel>(entDefinitions: EntsDataModel, options?: {
    scheduledDelete: ScheduledDeleteFuncRef;
}): RegisteredMutation<"internal", {
    origin: Origin;
    stack: Stack;
    inProgress: boolean;
}, Promise<void>>;
type PaginationArgs = {
    approach: Approach;
    table: string;
    cursor: string | null;
    indexName: string;
    fieldValue: any;
};
type EdgeArgs = {
    approach: Approach;
    table: string;
    indexName: string;
};
type Stack = ({
    id: string;
    table: string;
    edges: EdgeArgs[];
} | PaginationArgs)[];

export { type ScheduledDeleteFuncRef, scheduledDeleteFactory };
