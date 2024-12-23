"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/deletion.ts
var deletion_exports = {};
__export(deletion_exports, {
  scheduledDeleteFactory: () => scheduledDeleteFactory
});
module.exports = __toCommonJS(deletion_exports);
var import_server = require("convex/server");
var import_values = require("convex/values");

// src/shared.ts
function getEdgeDefinitions(entDefinitions, table) {
  return entDefinitions[table].edges;
}

// src/deletion.ts
var vApproach = import_values.v.union(import_values.v.literal("cascade"), import_values.v.literal("paginate"));
function scheduledDeleteFactory(entDefinitions, options) {
  const selfRef = options?.scheduledDelete ?? (0, import_server.makeFunctionReference)(
    "functions:scheduledDelete"
  );
  return (0, import_server.internalMutationGeneric)({
    args: {
      origin: import_values.v.object({
        id: import_values.v.string(),
        table: import_values.v.string(),
        deletionTime: import_values.v.number()
      }),
      stack: import_values.v.array(
        import_values.v.union(
          import_values.v.object({
            id: import_values.v.string(),
            table: import_values.v.string(),
            edges: import_values.v.array(
              import_values.v.object({
                approach: vApproach,
                table: import_values.v.string(),
                indexName: import_values.v.string()
              })
            )
          }),
          import_values.v.object({
            approach: vApproach,
            cursor: import_values.v.union(import_values.v.string(), import_values.v.null()),
            table: import_values.v.string(),
            indexName: import_values.v.string(),
            fieldValue: import_values.v.any()
          })
        )
      ),
      inProgress: import_values.v.boolean()
    },
    handler: async (ctx, { origin, stack, inProgress }) => {
      const originId = ctx.db.normalizeId(origin.table, origin.id);
      if (originId === null) {
        throw new Error(`Invalid ID "${origin.id}" for table ${origin.table}`);
      }
      const doc = await ctx.db.get(originId);
      if (doc.deletionTime !== origin.deletionTime) {
        if (inProgress) {
          console.error(
            `[Ents] Already in-progress scheduled deletion for "${origin.id}" was canceled!`
          );
        } else {
          console.log(
            `[Ents] Scheduled deletion for "${origin.id}" was canceled`
          );
        }
        return;
      }
      await progressScheduledDeletion(
        { ctx, entDefinitions, selfRef, origin },
        newCounter(),
        inProgress ? stack : [
          {
            id: originId,
            table: origin.table,
            edges: getEdgeArgs(entDefinitions, origin.table)
          }
        ]
      );
    }
  });
}
function getEdgeArgs(entDefinitions, table) {
  const edges = getEdgeDefinitions(entDefinitions, table);
  return Object.values(edges).flatMap((edgeDefinition) => {
    if (edgeDefinition.cardinality === "single" && edgeDefinition.type === "ref" || edgeDefinition.cardinality === "multiple" && edgeDefinition.type === "field") {
      const table2 = edgeDefinition.to;
      const targetEdges = getEdgeDefinitions(entDefinitions, table2);
      const hasCascadingEdges = Object.values(targetEdges).some(
        (edgeDefinition2) => edgeDefinition2.cardinality === "single" && edgeDefinition2.type === "ref" || edgeDefinition2.cardinality === "multiple"
      );
      const approach = hasCascadingEdges ? "cascade" : "paginate";
      const indexName = edgeDefinition.ref;
      return [{ table: table2, indexName, approach }];
    } else if (edgeDefinition.cardinality === "multiple") {
      const table2 = edgeDefinition.table;
      return [
        {
          table: table2,
          indexName: edgeDefinition.field,
          approach: "paginate"
        },
        ...edgeDefinition.symmetric ? [
          {
            table: table2,
            indexName: edgeDefinition.ref,
            approach: "paginate"
          }
        ] : []
      ];
    } else {
      return [];
    }
  });
}
async function progressScheduledDeletion(cascade, counter, stack) {
  const { ctx } = cascade;
  const last = stack[stack.length - 1];
  if ("id" in last) {
    const edgeArgs = last.edges[0];
    if (edgeArgs === void 0) {
      await ctx.db.delete(last.id);
      if (stack.length > 1) {
        await continueOrSchedule(cascade, counter, stack.slice(0, -1));
      }
    } else {
      const updated = { ...last, edges: last.edges.slice(1) };
      await paginateOrCascade(
        cascade,
        counter,
        stack.slice(0, -1).concat(updated),
        {
          cursor: null,
          fieldValue: last.id,
          ...edgeArgs
        }
      );
    }
  } else {
    await paginateOrCascade(cascade, counter, stack, last);
  }
}
var MAXIMUM_DOCUMENTS_READ = 8192 / 4;
var MAXIMUM_BYTES_READ = 2 ** 18;
async function paginateOrCascade(cascade, counter, stack, { table, approach, indexName, fieldValue, cursor }) {
  const { ctx, entDefinitions } = cascade;
  const { page, continueCursor, isDone, bytesRead } = await paginate(
    ctx,
    { table, indexName, fieldValue },
    {
      cursor,
      ...limitsBasedOnCounter(
        counter,
        approach === "paginate" ? { numItems: MAXIMUM_DOCUMENTS_READ } : { numItems: 1 }
      )
    }
  );
  const updatedCounter = incrementCounter(counter, page.length, bytesRead);
  const updated = {
    approach,
    table,
    cursor: continueCursor,
    indexName,
    fieldValue
  };
  const relevantStack = cursor === null ? stack : stack.slice(0, -1);
  const updatedStack = isDone && (approach === "paginate" || page.length === 0) ? relevantStack : relevantStack.concat(
    approach === "cascade" ? [
      updated,
      {
        id: page[0]._id,
        table,
        edges: getEdgeArgs(entDefinitions, table)
      }
    ] : [updated]
  );
  if (approach === "paginate") {
    await Promise.all(page.map((doc) => ctx.db.delete(doc._id)));
  }
  await continueOrSchedule(cascade, updatedCounter, updatedStack);
}
async function continueOrSchedule(cascade, counter, stack) {
  if (shouldSchedule(counter)) {
    const { ctx, selfRef, origin } = cascade;
    await ctx.scheduler.runAfter(0, selfRef, {
      origin,
      stack,
      inProgress: true
    });
  } else {
    await progressScheduledDeletion(cascade, counter, stack);
  }
}
function newCounter() {
  return {
    numDocuments: 0,
    numBytesRead: 0
  };
}
function incrementCounter(counter, numDocuments, numBytesRead) {
  return {
    numDocuments: counter.numDocuments + numDocuments,
    numBytesRead: counter.numBytesRead + numBytesRead
  };
}
function limitsBasedOnCounter(counter, { numItems }) {
  return {
    numItems: Math.max(1, numItems - counter.numDocuments),
    maximumBytesRead: Math.max(1, MAXIMUM_BYTES_READ - counter.numBytesRead)
  };
}
function shouldSchedule(counter) {
  return counter.numDocuments >= MAXIMUM_DOCUMENTS_READ || counter.numBytesRead >= MAXIMUM_BYTES_READ;
}
async function paginate(ctx, {
  table,
  indexName,
  fieldValue
}, {
  cursor,
  numItems,
  maximumBytesRead
}) {
  const query = ctx.db.query(table).withIndex(
    indexName,
    (q) => q.eq(indexName, fieldValue).gt(
      "_creationTime",
      cursor === null ? cursor : +cursor
    )
  );
  let bytesRead = 0;
  const results = [];
  let isDone = true;
  for await (const doc of query) {
    if (results.length >= numItems) {
      isDone = false;
      break;
    }
    const size = JSON.stringify((0, import_values.convexToJson)(doc)).length * 8;
    results.push(doc);
    bytesRead += size;
    if (bytesRead > maximumBytesRead) {
      isDone = false;
      break;
    }
  }
  return {
    page: results,
    continueCursor: results.length === 0 ? cursor : "" + results[results.length - 1]._creationTime,
    isDone,
    bytesRead
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  scheduledDeleteFactory
});
//# sourceMappingURL=deletion.js.map