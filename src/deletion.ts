import {
  FunctionReference,
  GenericMutationCtx,
  RegisteredMutation,
  internalMutationGeneric as internalMutation,
  makeFunctionReference,
} from "convex/server";
import { GenericId, v } from "convex/values";
import { getDeletionConfig, getEdgeDefinitions } from "./functions";
import { GenericEntsDataModel } from "./schema";
import { WriterImplBase } from "./writer";

export type ScheduledDeleteFuncRef = FunctionReference<
  "mutation",
  "internal",
  {
    origin: Origin;
    stack: Stack;
    inProgress: boolean;
  },
  void
>;

type Origin = {
  id: string;
  table: string;
  deletionTime: number;
};

const vApproach = v.union(
  v.literal("schedule"),
  v.literal("deleteOne"),
  v.literal("paginate")
);

export function scheduledDeleteFactory<
  EntsDataModel extends GenericEntsDataModel
>(
  entDefinitions: EntsDataModel,
  options?: {
    scheduledDelete: ScheduledDeleteFuncRef;
  }
): RegisteredMutation<
  "internal",
  { origin: Origin; stack: Stack; inProgress: boolean },
  Promise<void>
> {
  const selfRef =
    options?.scheduledDelete ??
    (makeFunctionReference(
      "functions:scheduledDelete"
    ) as unknown as ScheduledDeleteFuncRef);
  return internalMutation({
    args: {
      origin: v.object({
        id: v.string(),
        table: v.string(),
        deletionTime: v.number(),
      }),
      stack: v.array(
        v.union(
          v.object({
            id: v.string(),
            table: v.string(),
            edges: v.array(
              v.object({
                approach: vApproach,
                table: v.string(),
                indexName: v.string(),
              })
            ),
          }),
          v.object({
            approach: vApproach,
            cursor: v.union(v.string(), v.null()),
            table: v.string(),
            indexName: v.string(),
            fieldValue: v.any(),
          })
        )
      ),
      inProgress: v.boolean(),
    },
    handler: async (ctx, { origin, stack, inProgress }) => {
      const originId = ctx.db.normalizeId(origin.table, origin.id);
      if (originId === null) {
        throw new Error(`Invalid ID "${origin.id}" for table ${origin.table}`);
      }
      // Check that we still want to delete
      const doc = await ctx.db.get(originId);
      if (doc.deletionTime !== origin.deletionTime) {
        if (inProgress) {
          console.error(
            `[Ents] Already in-progress scheduled deletion for "${origin.id}" was cancelled!`
          );
        } else {
          console.log(
            `[Ents] Scheduled deletion for "${origin.id}" was cancelled`
          );
        }
        return;
      }
      await progressScheduledDeletion(
        ctx,
        entDefinitions,
        selfRef,
        origin,
        inProgress
          ? stack
          : [
              {
                id: originId,
                table: origin.table,
                edges: getEdgeArgs(entDefinitions, origin.table),
              },
            ]
      );
    },
  });
}

// Heuristic:
// Ent at the end of an edge
//  has soft or scheduled deletion behavior && has cascading edges: schedule individually
//  has cascading edges: paginate by 1
//  else: paginate by decent number
function getEdgeArgs(entDefinitions: GenericEntsDataModel, table: string) {
  const edges = getEdgeDefinitions(entDefinitions, table);
  return Object.values(edges).flatMap((edgeDefinition) => {
    if (
      (edgeDefinition.cardinality === "single" &&
        edgeDefinition.type === "ref") ||
      (edgeDefinition.cardinality === "multiple" &&
        edgeDefinition.type === "field")
    ) {
      const table = edgeDefinition.to;
      const targetDeletionConfig = getDeletionConfig(entDefinitions, table);
      const targetEdges = getEdgeDefinitions(entDefinitions, table);
      const hasCascadingEdges = Object.values(targetEdges).some(
        (edgeDefinition) =>
          (edgeDefinition.cardinality === "single" &&
            edgeDefinition.type === "ref") ||
          edgeDefinition.cardinality === "multiple"
      );
      const approach =
        targetDeletionConfig !== undefined && hasCascadingEdges
          ? "schedule"
          : hasCascadingEdges
          ? "deleteOne"
          : "paginate";

      const indexName = edgeDefinition.ref;
      return [{ table, indexName, approach } as const];
    } else if (edgeDefinition.cardinality === "multiple") {
      const table = edgeDefinition.table;
      return [
        {
          table,
          indexName: edgeDefinition.field,
          approach: "paginate",
        } as const,
        ...(edgeDefinition.symmetric
          ? [
              {
                table,
                indexName: edgeDefinition.ref,
                approach: "paginate",
              } as const,
            ]
          : []),
      ];
    } else {
      return [];
    }
  });
}

type Approach = "schedule" | "deleteOne" | "paginate";

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

type Stack = (
  | { id: string; table: string; edges: EdgeArgs[] }
  | PaginationArgs
)[];

async function progressScheduledDeletion(
  ctx: GenericMutationCtx<any>,
  entDefinitions: GenericEntsDataModel,
  selfRef: ScheduledDeleteFuncRef,
  origin: Origin,
  stack: Stack
) {
  const last = stack[stack.length - 1];

  if ("id" in last) {
    const edgeArgs = last.edges[0];
    if (edgeArgs === undefined) {
      await ctx.db.delete(last.id as GenericId<any>);
      if (stack.length > 1) {
        await ctx.scheduler.runAfter(0, selfRef, {
          origin,
          stack: stack.slice(0, -1),
          inProgress: true,
        });
      }
    } else {
      const updated = { ...last, edges: last.edges.slice(1) };
      await paginate(
        ctx,
        entDefinitions,
        selfRef,
        origin,
        stack.slice(0, -1).concat(updated),
        { cursor: null, fieldValue: last.id, ...edgeArgs }
      );
    }
  } else {
    await paginate(ctx, entDefinitions, selfRef, origin, stack, last);
  }
}

async function paginate(
  ctx: GenericMutationCtx<any>,
  entDefinitions: GenericEntsDataModel,
  selfRef: ScheduledDeleteFuncRef,
  origin: Origin,
  stack: Stack,
  { table, approach, indexName, fieldValue, cursor }: PaginationArgs
) {
  const { page, continueCursor, isDone } = await ctx.db
    .query(table)
    .withIndex(indexName, (q) => q.eq(indexName, fieldValue))
    .paginate({
      cursor,
      ...(approach === "paginate"
        ? { numItems: 8192 / 4, maximumBytesRead: 2 ** 18 }
        : { numItems: 1 }),
    });
  const updated = {
    approach,
    table,
    cursor: continueCursor,
    indexName,
    fieldValue,
  };
  const relevantStack = cursor === null ? stack : stack.slice(0, -1);
  if (approach === "schedule") {
    await ctx.scheduler.runAfter(0, selfRef, {
      origin,
      stack: isDone
        ? relevantStack
        : relevantStack.concat([
            updated,
            {
              id: page[0]._id,
              table,
              edges: getEdgeArgs(entDefinitions, table),
            },
          ]),
      inProgress: true,
    });
  } else {
    if (approach === "deleteOne") {
      await new WriterImplBase(ctx, entDefinitions, origin.table).deleteId(
        page[0].id,
        "hard"
      );
    } else {
      await Promise.all(page.map((doc) => ctx.db.delete(doc._id)));
    }
    await ctx.scheduler.runAfter(0, selfRef, {
      origin,
      stack: isDone ? relevantStack : relevantStack.concat([updated]),
      inProgress: true,
    });
  }
}
