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

// src/functions.ts
var functions_exports = {};
__export(functions_exports, {
  addEntRules: () => addEntRules,
  entWrapper: () => entWrapper,
  entsTableFactory: () => entsTableFactory,
  getDeletionConfig: () => getDeletionConfig,
  getReadRule: () => getReadRule,
  getWriteRule: () => getWriteRule
});
module.exports = __toCommonJS(functions_exports);

// src/schema.ts
var import_server = require("convex/server");
var import_values = require("convex/values");
function edgeCompoundIndexName(edgeDefinition) {
  return edgeCompoundIndexNameRaw(edgeDefinition.field, edgeDefinition.ref);
}
function edgeCompoundIndexNameRaw(idA, idB) {
  return `${idA}_${idB}`;
}

// src/shared.ts
function getEdgeDefinitions(entDefinitions, table) {
  return entDefinitions[table].edges;
}

// src/writer.ts
var import_server2 = require("convex/server");
var WriterImplBase = class _WriterImplBase {
  constructor(ctx, entDefinitions, table) {
    this.ctx = ctx;
    this.entDefinitions = entDefinitions;
    this.table = table;
  }
  async deleteId(id, behavior) {
    await this.checkReadAndWriteRule("delete", id, void 0);
    const deletionConfig = getDeletionConfig(this.entDefinitions, this.table);
    const isDeletingSoftly = behavior !== "hard" && deletionConfig !== void 0 && (deletionConfig.type === "soft" || deletionConfig.type === "scheduled");
    if (behavior === "soft" && !isDeletingSoftly) {
      throw new Error(
        `Cannot soft delete document with ID "${id}" in table "${this.table}" because it does not have a "soft" or "scheduled" deletion behavior configured.`
      );
    }
    const edges = {};
    await Promise.all(
      Object.values(getEdgeDefinitions(this.entDefinitions, this.table)).map(
        async (edgeDefinition) => {
          const key = edgeDefinition.name;
          if (edgeDefinition.cardinality === "single" && edgeDefinition.type === "ref" || edgeDefinition.cardinality === "multiple" && edgeDefinition.type === "field") {
            if (!isDeletingSoftly || edgeDefinition.deletion === "soft") {
              const remove = (await this.ctx.db.query(edgeDefinition.to).withIndex(
                edgeDefinition.ref,
                (q) => q.eq(edgeDefinition.ref, id)
              ).collect()).map((doc) => doc._id);
              edges[key] = { remove };
            }
          } else if (edgeDefinition.cardinality === "single") {
            if (edgeDefinition.deletion !== void 0 && (!isDeletingSoftly || edgeDefinition.deletion === "soft")) {
              const doc = await this.ctx.db.get(id);
              if (doc !== null) {
                const otherId = doc[edgeDefinition.field];
                edges[key] = {
                  remove: otherId !== void 0 ? [otherId] : []
                };
              }
            }
          } else if (edgeDefinition.cardinality === "multiple") {
            if (!isDeletingSoftly) {
              const removeEdges = (await this.ctx.db.query(edgeDefinition.table).withIndex(
                edgeDefinition.field,
                (q) => q.eq(edgeDefinition.field, id)
              ).collect()).concat(
                edgeDefinition.symmetric ? await this.ctx.db.query(edgeDefinition.table).withIndex(
                  edgeDefinition.ref,
                  (q) => q.eq(edgeDefinition.ref, id)
                ).collect() : []
              ).map((doc) => doc._id);
              edges[key] = { removeEdges };
            }
          }
        }
      )
    );
    const deletionTime = +/* @__PURE__ */ new Date();
    if (isDeletingSoftly) {
      await this.ctx.db.patch(id, { deletionTime });
    } else {
      try {
        await this.ctx.db.delete(id);
      } catch (e) {
      }
    }
    await this.writeEdges(id, edges, isDeletingSoftly);
    if (deletionConfig !== void 0 && deletionConfig.type === "scheduled") {
      const fnRef = this.ctx.scheduledDelete ?? (0, import_server2.makeFunctionReference)(
        "functions:scheduledDelete"
      );
      await this.ctx.scheduler.runAfter(deletionConfig.delayMs ?? 0, fnRef, {
        origin: {
          id,
          table: this.table,
          deletionTime
        },
        inProgress: false,
        stack: []
      });
    }
    return id;
  }
  async deleteIdIn(id, table, cascadingSoft) {
    await new _WriterImplBase(this.ctx, this.entDefinitions, table).deleteId(
      id,
      cascadingSoft ? "soft" : "hard"
    );
  }
  async deleteSystem(table, id) {
    switch (table) {
      case "_storage":
        await this.ctx.storage.delete(id);
        break;
      case "_scheduled_functions":
        await this.ctx.scheduler.cancel(id);
        break;
      default:
        throw new Error(
          `Cannot cascade deletion to unsupported system table "${table}".`
        );
    }
  }
  async writeEdges(docId, changes, deleteSoftly) {
    await Promise.all(
      Object.values(getEdgeDefinitions(this.entDefinitions, this.table)).map(
        async (edgeDefinition) => {
          const idOrIds = changes[edgeDefinition.name];
          if (idOrIds === void 0) {
            return;
          }
          if (edgeDefinition.cardinality === "single" && edgeDefinition.type === "ref" || edgeDefinition.cardinality === "multiple" && edgeDefinition.type === "field") {
            if (idOrIds.remove !== void 0 && idOrIds.remove.length > 0) {
              await Promise.all(
                idOrIds.remove.map(
                  (id) => this.deleteIdIn(
                    id,
                    edgeDefinition.to,
                    (deleteSoftly ?? false) && edgeDefinition.deletion === "soft"
                  )
                )
              );
            }
            if (idOrIds.add !== void 0 && idOrIds.add.length > 0) {
              await Promise.all(
                idOrIds.add.map(
                  async (id) => this.ctx.db.patch(id, {
                    [edgeDefinition.ref]: docId
                  })
                )
              );
            }
          } else if (edgeDefinition.cardinality === "single") {
            if (idOrIds.remove !== void 0 && idOrIds.remove.length > 0) {
              await Promise.all(
                idOrIds.remove.map(
                  isSystemTable(edgeDefinition.to) ? (id) => this.deleteSystem(edgeDefinition.to, id) : (id) => this.deleteIdIn(
                    id,
                    edgeDefinition.to,
                    (deleteSoftly ?? false) && edgeDefinition.deletion === "soft"
                  )
                )
              );
            }
          } else if (edgeDefinition.cardinality === "multiple") {
            if ((idOrIds.removeEdges ?? []).length > 0) {
              await Promise.all(
                idOrIds.removeEdges.map(async (id) => {
                  try {
                    await this.ctx.db.delete(id);
                  } catch (e) {
                  }
                })
              );
            }
            if (idOrIds.add !== void 0) {
              await Promise.all(
                [...new Set(idOrIds.add)].map(async (id) => {
                  const existing = await this.ctx.db.query(edgeDefinition.table).withIndex(
                    edgeCompoundIndexName(edgeDefinition),
                    (q) => q.eq(edgeDefinition.field, docId).eq(
                      edgeDefinition.ref,
                      id
                    )
                  ).first();
                  if (existing === null) {
                    await this.ctx.db.insert(edgeDefinition.table, {
                      [edgeDefinition.field]: docId,
                      [edgeDefinition.ref]: id
                    });
                    if (edgeDefinition.symmetric) {
                      await this.ctx.db.insert(edgeDefinition.table, {
                        [edgeDefinition.field]: id,
                        [edgeDefinition.ref]: docId
                      });
                    }
                  }
                })
              );
            }
          }
        }
      )
    );
  }
  async checkUniqueness(value, id) {
    await Promise.all(
      Object.values(
        this.entDefinitions[this.table].fields
      ).map(async (fieldDefinition) => {
        if (fieldDefinition.unique) {
          const key = fieldDefinition.name;
          const fieldValue = value[key];
          const existing = await this.ctx.db.query(this.table).withIndex(key, (q) => q.eq(key, value[key])).unique();
          if (existing !== null && (id === void 0 || existing._id !== id)) {
            throw new Error(
              `In table "${this.table}" cannot create a duplicate document with field "${key}" of value \`${fieldValue}\`, existing document with ID "${existing._id}" already has it.`
            );
          }
        }
      })
    );
    await Promise.all(
      Object.values(getEdgeDefinitions(this.entDefinitions, this.table)).map(
        async (edgeDefinition) => {
          if (edgeDefinition.cardinality === "single" && edgeDefinition.type === "field" && edgeDefinition.unique) {
            const key = edgeDefinition.field;
            if (value[key] === void 0) {
              return;
            }
            const existing = await this.ctx.db.query(this.table).withIndex(key, (q) => q.eq(key, value[key])).unique();
            if (existing !== null && (id === void 0 || existing._id !== id)) {
              throw new Error(
                `In table "${this.table}" cannot create a duplicate 1:1 edge "${edgeDefinition.name}" to ID "${value[key]}", existing document with ID "${existing._id}" already has it.`
              );
            }
          }
        }
      )
    );
  }
  fieldsOnly(value) {
    const fields = {};
    Object.keys(value).forEach((key) => {
      const edgeDefinition = getEdgeDefinitions(
        this.entDefinitions,
        this.table
      )[key];
      if (edgeDefinition === void 0 || edgeDefinition.cardinality === "single" && edgeDefinition.type === "field" && edgeDefinition.field === key) {
        fields[key] = value[key];
      }
    });
    return fields;
  }
  async checkReadAndWriteRule(operation, id, value) {
    if (id !== void 0) {
      const readPolicy = getReadRule(this.entDefinitions, this.table);
      if (readPolicy !== void 0) {
        const doc = await this.ctx.db.get(id);
        if (doc === null) {
          throw new Error(
            `Cannot update document with ID "${id}" in table "${this.table} because it does not exist"`
          );
        }
        const decision2 = await readPolicy(doc);
        if (!decision2) {
          throw new Error(
            `Cannot update document with ID "${id}" from table "${this.table}"`
          );
        }
      }
    }
    const writePolicy = getWriteRule(this.entDefinitions, this.table);
    if (writePolicy === void 0) {
      return;
    }
    const ent = id === void 0 ? void 0 : entWrapper(
      await this.ctx.db.get(id),
      this.ctx,
      this.entDefinitions,
      this.table
    );
    const { _id, _creationTime, ...safeValue } = value ?? {};
    const decision = await writePolicy({
      operation,
      ent,
      value: value !== void 0 ? safeValue : void 0
    });
    if (!decision) {
      if (id === void 0) {
        throw new Error(
          `Cannot insert into table "${this.table}": \`${JSON.stringify(
            value
          )}\``
        );
      } else if (value === void 0) {
        throw new Error(
          `Cannot delete from table "${this.table}" with ID "${id}"`
        );
      } else {
        throw new Error(
          `Cannot update document with ID "${id}" in table "${this.table}" with: \`${JSON.stringify(value)}\``
        );
      }
    }
  }
};
function isSystemTable(table) {
  return table.startsWith("_");
}

// src/functions.ts
var PromiseQueryOrNullImpl = class _PromiseQueryOrNullImpl extends Promise {
  constructor(ctx, entDefinitions, table, retrieve) {
    super(() => {
    });
    this.ctx = ctx;
    this.entDefinitions = entDefinitions;
    this.table = table;
    this.retrieve = retrieve;
  }
  filter(predicate) {
    return new _PromiseQueryOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const query = await this.retrieve();
        if (query === null) {
          return null;
        }
        return query.filter(predicate);
      }
    );
  }
  map(callbackFn) {
    return new PromiseArrayImpl(async () => {
      const array = await this;
      if (array === null) {
        return null;
      }
      return await Promise.all(array.map(callbackFn));
    });
  }
  order(order, indexName) {
    return new _PromiseQueryOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const query = await this.retrieve();
        if (query === null) {
          return null;
        }
        if (indexName !== void 0) {
          return query.withIndex(indexName).order(order);
        }
        return query.order(order);
      }
    );
  }
  paginate(paginationOpts) {
    return new PromisePaginationResultOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const query = await this.retrieve();
        if (query === null) {
          return null;
        }
        return await query.paginate(paginationOpts);
      }
    );
  }
  take(n) {
    return new PromiseEntsOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        return await this._take(n);
      },
      false
    );
  }
  first() {
    return new PromiseEntOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const docs = await this._take(1);
        if (docs === null) {
          return nullRetriever;
        }
        const [doc] = docs;
        return loadedRetriever(doc);
      },
      false
    );
  }
  firstX() {
    return new PromiseEntWriterImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const docs = await this._take(1);
        if (docs === null) {
          return nullRetriever;
        }
        const [doc] = docs;
        if (doc === void 0) {
          throw new Error("Query returned no documents");
        }
        return loadedRetriever(doc);
      },
      false
    );
  }
  unique() {
    return new PromiseEntOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const docs = await this._take(2);
        if (docs === null) {
          return nullRetriever;
        }
        if (docs.length === 0) {
          return nullRetriever;
        }
        if (docs.length === 2) {
          throw new Error("unique() query returned more than one result");
        }
        const [doc] = docs;
        return loadedRetriever(doc);
      },
      false
    );
  }
  uniqueX() {
    return new PromiseEntWriterImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const docs = await this._take(2);
        if (docs === null) {
          return nullRetriever;
        }
        if (docs.length === 0) {
          throw new Error("Query returned no documents");
        }
        if (docs.length === 2) {
          throw new Error("unique() query returned more than one result");
        }
        const [doc] = docs;
        return loadedRetriever(doc);
      },
      true
    );
  }
  async docs() {
    const query = await this.retrieve();
    if (query === null) {
      return null;
    }
    const docs = await query.collect();
    return filterByReadRule(
      this.ctx,
      this.entDefinitions,
      this.table,
      docs,
      false
    );
  }
  then(onfulfilled, onrejected) {
    return this.docs().then(
      (documents) => documents === null ? null : documents.map(
        (doc) => entWrapper(doc, this.ctx, this.entDefinitions, this.table)
      )
    ).then(onfulfilled, onrejected);
  }
  async _take(n) {
    const query = await this.retrieve();
    return await takeFromQuery(
      query,
      n,
      this.ctx,
      this.entDefinitions,
      this.table
    );
  }
};
var PromisePaginationResultOrNullImpl = class extends Promise {
  constructor(ctx, entDefinitions, table, retrieve) {
    super(() => {
    });
    this.ctx = ctx;
    this.entDefinitions = entDefinitions;
    this.table = table;
    this.retrieve = retrieve;
  }
  async map(callbackFn) {
    const result = await this;
    if (result === null) {
      return null;
    }
    return {
      ...result,
      page: await Promise.all(result.page.map(callbackFn))
    };
  }
  async docs() {
    const result = await this.retrieve();
    if (result === null) {
      return null;
    }
    return {
      ...result,
      page: await filterByReadRule(
        this.ctx,
        this.entDefinitions,
        this.table,
        result.page,
        false
      )
    };
  }
  then(onfulfilled, onrejected) {
    return this.docs().then(
      (result) => result === null ? null : {
        ...result,
        page: result.page.map(
          (doc) => entWrapper(doc, this.ctx, this.entDefinitions, this.table)
        )
      }
    ).then(onfulfilled, onrejected);
  }
};
var PromiseTableImpl = class extends PromiseQueryOrNullImpl {
  constructor(ctx, entDefinitions, table) {
    super(
      ctx,
      entDefinitions,
      table,
      async () => isSystemTable(table) ? ctx.db.system.query(table) : ctx.db.query(table)
    );
  }
  get(...args) {
    return this.getImpl(args);
  }
  getX(...args) {
    return this.getImpl(args, true);
  }
  getMany(...args) {
    return this.getManyImpl(args);
  }
  getManyX(...args) {
    return this.getManyImpl(args, true);
  }
  getImpl(args, throwIfNull = false) {
    return new PromiseEntWriterImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      args.length === 1 ? async () => {
        const id = args[0];
        if (this.normalizeId(id) === null) {
          throw new Error(`Invalid id \`${id}\` for table "${this.table}"`);
        }
        return {
          id,
          doc: async () => {
            const doc = await (isSystemTable(this.table) ? this.ctx.db.system.get(id) : this.ctx.db.get(id));
            if (throwIfNull && doc === null) {
              throw new Error(
                `Document not found with id \`${id}\` in table "${this.table}"`
              );
            }
            return doc;
          }
        };
      } : async () => {
        const [indexName, ...values] = args;
        const fieldNames = getIndexFields(
          this.entDefinitions,
          this.table,
          indexName
        );
        const doc = await this.ctx.db.query(this.table).withIndex(
          indexName,
          (q) => values.reduce((q2, value, i) => q2.eq(fieldNames?.[i], value), q)
        ).unique();
        if (throwIfNull && doc === null) {
          throw new Error(
            `Table "${this.table}" does not contain document with field${values.reduce(
              (message, value, i) => `${message} "${fieldNames[i]}" = \`${value}\``,
              ""
            )}`
          );
        }
        return loadedRetriever(doc);
      },
      throwIfNull
    );
  }
  getManyImpl(args, throwIfNull = false) {
    return new PromiseEntsOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      args.length === 1 ? async () => {
        const ids = args[0];
        ids.forEach((id) => {
          if (this.normalizeId(id) === null) {
            throw new Error(
              `Invalid id \`${id}\` for table "${this.table}"`
            );
          }
        });
        return await Promise.all(
          ids.map(async (id) => {
            const doc = await (isSystemTable(this.table) ? this.ctx.db.system.get(id) : this.ctx.db.get(id));
            if (throwIfNull && doc === null) {
              throw new Error(
                `Document not found with id \`${id}\` in table "${this.table}"`
              );
            }
            return doc;
          })
        );
      } : async () => {
        const [indexName, values] = args;
        return await Promise.all(
          values.map(async (value) => {
            const doc = await this.ctx.db.query(this.table).withIndex(indexName, (q) => q.eq(indexName, value)).unique();
            if (throwIfNull && doc === null) {
              throw new Error(
                `Table "${this.table}" does not contain document with field "${indexName}" = \`${value}\``
              );
            }
            return doc;
          })
        );
      },
      throwIfNull
    );
  }
  normalizeId(id) {
    return isSystemTable(this.table) ? this.ctx.db.system.normalizeId(this.table, id) : this.ctx.db.normalizeId(this.table, id);
  }
  // normalizeId or throw
  normalizeIdX(id) {
    const normalized = this.normalizeId(id);
    if (normalized === null) {
      throw new Error(`Invalid id \`${id}\` for table "${this.table}"`);
    }
    return normalized;
  }
  withIndex(indexName, indexRange) {
    return new PromiseQueryOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const query = await this.retrieve();
        return query.withIndex(indexName, indexRange);
      }
    );
  }
  search(indexName, searchFilter) {
    return new PromiseQueryOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const query = await this.retrieve();
        return query.withSearchIndex(indexName, searchFilter);
      }
    );
  }
};
var PromiseEntsOrNullImpl = class extends Promise {
  constructor(ctx, entDefinitions, table, retrieve, throwIfNull) {
    super(() => {
    });
    this.ctx = ctx;
    this.entDefinitions = entDefinitions;
    this.table = table;
    this.retrieve = retrieve;
    this.throwIfNull = throwIfNull;
  }
  map(callbackFn) {
    return new PromiseArrayImpl(async () => {
      const array = await this;
      if (array === null) {
        return null;
      }
      return await Promise.all(array.map(callbackFn));
    });
  }
  first() {
    return new PromiseEntOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const docs = await this.retrieve();
        if (docs === null) {
          return nullRetriever;
        }
        return loadedRetriever(docs[0] ?? null);
      },
      false
    );
  }
  firstX() {
    return new PromiseEntOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const docs = await this.retrieve();
        if (docs === null) {
          return nullRetriever;
        }
        const doc = docs[0] ?? void 0;
        if (doc === void 0) {
          throw new Error("Query returned no documents");
        }
        return loadedRetriever(doc);
      },
      true
    );
  }
  unique() {
    return new PromiseEntOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const docs = await this.retrieve();
        if (docs === null) {
          return nullRetriever;
        }
        if (docs.length > 1) {
          throw new Error("unique() query returned more than one result");
        }
        return loadedRetriever(docs[0] ?? null);
      },
      false
    );
  }
  uniqueX() {
    return new PromiseEntOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const docs = await this.retrieve();
        if (docs === null) {
          return nullRetriever;
        }
        if (docs.length > 1) {
          throw new Error("unique() query returned more than one result");
        }
        if (docs.length < 1) {
          throw new Error("unique() query returned no documents");
        }
        return loadedRetriever(docs[0]);
      },
      true
    );
  }
  async docs() {
    const docs = await this.retrieve();
    return filterByReadRule(
      this.ctx,
      this.entDefinitions,
      this.table,
      docs,
      this.throwIfNull
    );
  }
  then(onfulfilled, onrejected) {
    return this.docs().then(
      (docs) => (
        // Handles PromiseEntsOrNulls
        docs === null ? null : docs.map(
          (doc) => doc === null ? null : entWrapper(doc, this.ctx, this.entDefinitions, this.table)
        )
      )
    ).then(onfulfilled, onrejected);
  }
};
var PromiseEdgeOrNullImpl = class _PromiseEdgeOrNullImpl extends PromiseEntsOrNullImpl {
  constructor(ctx, entDefinitions, table, edgeDefinition, retrieveSourceId, retrieveQuery, retrieveDoc = async (edgeDoc) => {
    const sourceId = edgeDoc[edgeDefinition.field];
    const targetId = edgeDoc[edgeDefinition.ref];
    const doc = await this.ctx.db.get(targetId);
    if (doc === null) {
      throw new Error(
        `Dangling reference for edge "${edgeDefinition.name}" in table "${this.table}" for document with ID "${sourceId}": Could not find a document with ID "${targetId}" in table "${edgeDefinition.to}" (edge document ID is "${edgeDoc._id}").`
      );
    }
    return doc;
  }) {
    super(
      ctx,
      entDefinitions,
      table,
      async () => {
        const query = await retrieveQuery();
        if (query === null) {
          return null;
        }
        const edgeDocs = await query.collect();
        return await Promise.all(edgeDocs.map(retrieveDoc));
      },
      false
    );
    this.edgeDefinition = edgeDefinition;
    this.retrieveSourceId = retrieveSourceId;
    this.retrieveQuery = retrieveQuery;
    this.retrieveDoc = retrieveDoc;
  }
  async has(targetId) {
    const sourceId = await this.retrieveSourceId();
    if (sourceId === null) {
      return null;
    }
    const edgeDoc = await this.ctx.db.query(this.edgeDefinition.table).withIndex(
      edgeCompoundIndexName(this.edgeDefinition),
      (q) => q.eq(this.edgeDefinition.field, sourceId).eq(
        this.edgeDefinition.ref,
        targetId
      )
    ).first();
    return edgeDoc !== null;
  }
  order(order) {
    return new _PromiseEdgeOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      this.edgeDefinition,
      this.retrieveSourceId,
      async () => {
        const query = await this.retrieveQuery();
        if (query === null) {
          return null;
        }
        return query.order(order);
      }
    );
  }
  paginate(paginationOpts) {
    return new PromisePaginationResultOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const query = await this.retrieveQuery();
        if (query === null) {
          return null;
        }
        const result = await query.paginate(paginationOpts);
        return {
          ...result,
          page: await Promise.all(result.page.map(this.retrieveDoc))
        };
      }
    );
  }
  take(n) {
    return new PromiseEntsOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        return await this._take(n);
      },
      false
    );
  }
  first() {
    return new PromiseEntOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const docs = await this._take(1);
        if (docs === null) {
          return nullRetriever;
        }
        const [doc] = docs;
        return loadedRetriever(doc);
      },
      false
    );
  }
  firstX() {
    return new PromiseEntWriterImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const docs = await this._take(1);
        if (docs === null) {
          return nullRetriever;
        }
        const [doc] = docs;
        if (doc === void 0) {
          throw new Error("Query returned no documents");
        }
        return loadedRetriever(doc);
      },
      false
    );
  }
  unique() {
    return new PromiseEntOrNullImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const docs = await this._take(2);
        if (docs === null) {
          return nullRetriever;
        }
        if (docs.length === 0) {
          return nullRetriever;
        }
        if (docs.length === 2) {
          throw new Error("unique() query returned more than one result");
        }
        const [doc] = docs;
        return loadedRetriever(doc);
      },
      false
    );
  }
  uniqueX() {
    return new PromiseEntWriterImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const docs = await this._take(2);
        if (docs === null) {
          return nullRetriever;
        }
        if (docs.length === 0) {
          throw new Error("Query returned no documents");
        }
        if (docs.length === 2) {
          throw new Error("unique() query returned more than one result");
        }
        const [doc] = docs;
        return loadedRetriever(doc);
      },
      true
    );
  }
  async _take(n) {
    const query = await this.retrieveQuery();
    return await takeFromQuery(
      query,
      n,
      this.ctx,
      this.entDefinitions,
      this.table,
      this.retrieveDoc
    );
  }
};
var PromiseEntOrNullImpl = class extends Promise {
  constructor(ctx, entDefinitions, table, retrieve, throwIfNull) {
    super(() => {
    });
    this.ctx = ctx;
    this.entDefinitions = entDefinitions;
    this.table = table;
    this.retrieve = retrieve;
    this.throwIfNull = throwIfNull;
  }
  async doc() {
    const { id, doc: getDoc } = await this.retrieve();
    if (id === null) {
      return null;
    }
    const doc = await getDoc();
    if (doc === null) {
      return null;
    }
    const readPolicy = getReadRule(this.entDefinitions, this.table);
    if (readPolicy !== void 0) {
      const decision = await readPolicy(
        entWrapper(doc, this.ctx, this.entDefinitions, this.table)
      );
      if (this.throwIfNull && !decision) {
        throw new Error(
          `Document cannot be read with id \`${doc._id}\` in table "${this.table}"`
        );
      }
      return decision ? doc : null;
    }
    return doc;
  }
  then(onfulfilled, onrejected) {
    return this.doc().then(
      (doc) => doc === null ? null : entWrapper(doc, this.ctx, this.entDefinitions, this.table)
    ).then(onfulfilled, onrejected);
  }
  edge(edge) {
    return this.edgeImpl(edge);
  }
  edgeX(edge) {
    return this.edgeImpl(edge, true);
  }
  edgeImpl(edge, throwIfNull = false) {
    const edgeDefinition = getEdgeDefinitions(this.entDefinitions, this.table)[edge];
    if (edgeDefinition.cardinality === "multiple") {
      if (edgeDefinition.type === "ref") {
        return new PromiseEdgeOrNullImpl(
          this.ctx,
          this.entDefinitions,
          edgeDefinition.to,
          edgeDefinition,
          async () => {
            const { id } = await this.retrieve();
            return id;
          },
          async () => {
            const { id } = await this.retrieve();
            if (id === null) {
              return null;
            }
            return this.ctx.db.query(edgeDefinition.table).withIndex(
              edgeDefinition.field,
              (q) => q.eq(edgeDefinition.field, id)
            );
          }
        );
      }
      return new PromiseQueryOrNullImpl(
        this.ctx,
        this.entDefinitions,
        edgeDefinition.to,
        async () => {
          const { id } = await this.retrieve();
          if (id === null) {
            return null;
          }
          return this.ctx.db.query(edgeDefinition.to).withIndex(
            edgeDefinition.ref,
            (q) => q.eq(edgeDefinition.ref, id)
          );
        }
      );
    }
    return new PromiseEntWriterImpl(
      this.ctx,
      this.entDefinitions,
      edgeDefinition.to,
      async () => {
        const { id, doc: getDoc } = await this.retrieve();
        if (id === null) {
          return nullRetriever;
        }
        if (edgeDefinition.type === "ref") {
          const otherDoc = await this.ctx.db.query(edgeDefinition.to).withIndex(
            edgeDefinition.ref,
            (q) => q.eq(edgeDefinition.ref, id)
          ).unique();
          if (throwIfNull && otherDoc === null) {
            throw new Error(
              `Edge "${edgeDefinition.name}" does not exist for document with ID "${id}"`
            );
          }
          return loadedRetriever(otherDoc);
        }
        const doc = await getDoc();
        const otherId = doc[edgeDefinition.field];
        return {
          id: otherId,
          doc: async () => {
            if (otherId === void 0) {
              if (edgeDefinition.optional) {
                return null;
              }
              throw new Error(
                `Unexpected null reference for edge "${edgeDefinition.name}" in table "${this.table}" on document with ID "${id}": Expected an ID for a document in table "${edgeDefinition.to}".`
              );
            }
            const otherDoc = await this.ctx.db.get(otherId);
            if (otherDoc === null && edgeDefinition.to !== "_scheduled_functions") {
              throw new Error(
                `Dangling reference for edge "${edgeDefinition.name}" in table "${this.table}" on document with ID "${id}": Could not find a document with ID "${otherId}" in table "${edgeDefinition.to}".`
              );
            }
            return otherDoc;
          }
        };
      },
      throwIfNull
    );
  }
};
var PromiseArrayImpl = class extends Promise {
  constructor(retrieve) {
    super(() => {
    });
    this.retrieve = retrieve;
  }
  async filter(predicate) {
    const array = await this.retrieve();
    if (array === null) {
      return null;
    }
    return array.filter(predicate);
  }
  then(onfulfilled, onrejected) {
    return this.retrieve().then(onfulfilled, onrejected);
  }
};
function entWrapper(fields, ctx, entDefinitions, table) {
  const doc = { ...fields };
  const queryInterface = new PromiseEntWriterImpl(
    ctx,
    entDefinitions,
    table,
    async () => ({ id: doc._id, doc: async () => doc }),
    // this `true` doesn't matter, the queryInterface cannot be awaited
    true
  );
  Object.defineProperty(doc, "edge", {
    value: (edge) => {
      return queryInterface.edge(edge);
    },
    enumerable: false,
    writable: false,
    configurable: false
  });
  Object.defineProperty(doc, "edgeX", {
    value: (edge) => {
      return queryInterface.edgeX(edge);
    },
    enumerable: false,
    writable: false,
    configurable: false
  });
  Object.defineProperty(doc, "_edges", {
    value: () => {
      return getEdgeDefinitions(entDefinitions, table);
    },
    enumerable: false,
    writable: false,
    configurable: false
  });
  Object.defineProperty(doc, "doc", {
    value: () => {
      return doc;
    },
    enumerable: false,
    writable: false,
    configurable: false
  });
  Object.defineProperty(doc, "patch", {
    value: (value) => {
      return queryInterface.patch(value);
    },
    enumerable: false,
    writable: false,
    configurable: false
  });
  Object.defineProperty(doc, "replace", {
    value: (value) => {
      return queryInterface.replace(value);
    },
    enumerable: false,
    writable: false,
    configurable: false
  });
  Object.defineProperty(doc, "delete", {
    value: () => {
      return queryInterface.delete();
    },
    enumerable: false,
    writable: false,
    configurable: false
  });
  Object.entries(entDefinitions[table]?.defaults ?? []).map(
    ([field, value]) => {
      if (doc[field] === void 0) {
        doc[field] = value;
      }
    }
  );
  return doc;
}
function entsTableFactory(ctx, entDefinitions, options) {
  const enrichedCtx = options !== void 0 ? { ...ctx, ...options } : ctx;
  const table = (table2, indexName, indexRange) => {
    if (typeof table2 !== "string") {
      throw new Error(`Expected table name, got \`${table2}\``);
    }
    if (indexName !== void 0) {
      return new PromiseTableImpl(
        enrichedCtx,
        entDefinitions,
        table2
      ).withIndex(indexName, indexRange);
    }
    if (ctx.db.insert !== void 0) {
      return new PromiseTableWriterImpl(
        enrichedCtx,
        entDefinitions,
        table2
      );
    }
    return new PromiseTableImpl(enrichedCtx, entDefinitions, table2);
  };
  table.system = table;
  return table;
}
var PromiseTableWriterImpl = class extends PromiseTableImpl {
  constructor(ctx, entDefinitions, table) {
    super(ctx, entDefinitions, table);
    this.ctx = ctx;
    this.base = new WriterImplBase(ctx, entDefinitions, table);
  }
  base;
  insert(value) {
    return new PromiseEntIdImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        await this.base.checkReadAndWriteRule("create", void 0, value);
        await this.base.checkUniqueness(value);
        const fields = this.base.fieldsOnly(value);
        const docId = await this.ctx.db.insert(this.table, fields);
        const edges = {};
        Object.keys(value).forEach((key) => {
          const edgeDefinition = getEdgeDefinitions(
            this.entDefinitions,
            this.table
          )[key];
          if (edgeDefinition === void 0 || edgeDefinition.cardinality === "single" && edgeDefinition.type === "field") {
            return;
          }
          edges[key] = {
            add: edgeDefinition.cardinality === "single" ? [value[key]] : value[key]
          };
        });
        await this.base.writeEdges(docId, edges);
        return docId;
      }
    );
  }
  // TODO: fluent API
  async insertMany(values) {
    return await Promise.all(values.map((value) => this.insert(value)));
  }
};
var PromiseEntWriterImpl = class extends PromiseEntOrNullImpl {
  constructor(ctx, entDefinitions, table, retrieve, throwIfNull) {
    super(ctx, entDefinitions, table, retrieve, throwIfNull);
    this.ctx = ctx;
    this.entDefinitions = entDefinitions;
    this.table = table;
    this.retrieve = retrieve;
    this.throwIfNull = throwIfNull;
    this.base = new WriterImplBase(ctx, entDefinitions, table);
  }
  base;
  patch(value) {
    return new PromiseEntIdImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const { id: docId } = await this.retrieve();
        const id = docId;
        await this.base.checkReadAndWriteRule("update", id, value);
        await this.base.checkUniqueness(value, id);
        const fields = this.base.fieldsOnly(value);
        await this.ctx.db.patch(id, fields);
        const edges = {};
        await Promise.all(
          Object.keys(value).map(async (key) => {
            const edgeDefinition = getEdgeDefinitions(
              this.entDefinitions,
              this.table
            )[key];
            if (edgeDefinition === void 0 || edgeDefinition.cardinality === "single" && edgeDefinition.type === "field") {
              return;
            }
            if (edgeDefinition.cardinality === "single") {
              throw new Error(
                `Cannot set 1:1 edge "${edgeDefinition.name}" on ent in table "${this.table}", update the ent in "${edgeDefinition.to}"  table instead.`
              );
            } else {
              if (edgeDefinition.type === "field") {
                throw new Error(
                  `Cannot set 1:many edges "${edgeDefinition.name}" on ent in table "${this.table}", update the ents in "${edgeDefinition.to}"  table instead.`
                );
              } else {
                const { add, remove } = value[key];
                const removeEdges = (await Promise.all(
                  (remove ?? []).map(
                    async (otherId) => (await this.ctx.db.query(edgeDefinition.table).withIndex(
                      edgeCompoundIndexName(edgeDefinition),
                      (q) => q.eq(edgeDefinition.field, id).eq(
                        edgeDefinition.ref,
                        otherId
                      )
                    ).collect()).concat(
                      edgeDefinition.symmetric ? await this.ctx.db.query(edgeDefinition.table).withIndex(
                        edgeCompoundIndexName(edgeDefinition),
                        (q) => q.eq(
                          edgeDefinition.field,
                          otherId
                        ).eq(edgeDefinition.ref, id)
                      ).collect() : []
                    )
                  )
                )).flat().map((edgeDoc) => edgeDoc._id);
                edges[key] = {
                  add,
                  removeEdges
                };
              }
            }
          })
        );
        await this.base.writeEdges(id, edges);
        return id;
      }
    );
  }
  replace(value) {
    return new PromiseEntIdImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const { id } = await this.retrieve();
        const docId = id;
        await this.base.checkReadAndWriteRule("update", docId, value);
        await this.base.checkUniqueness(value, docId);
        const fields = this.base.fieldsOnly(value);
        await this.ctx.db.replace(docId, fields);
        const edges = {};
        await Promise.all(
          Object.values(
            getEdgeDefinitions(this.entDefinitions, this.table)
          ).map(async (edgeDefinition) => {
            const key = edgeDefinition.name;
            const idOrIds = value[key];
            if (edgeDefinition.cardinality === "single") {
              if (edgeDefinition.type === "ref") {
                const oldDoc = await this.ctx.db.get(docId);
                if (oldDoc[key] !== void 0 && oldDoc[key] !== idOrIds) {
                  throw new Error("Cannot set 1:1 edge from ref end.");
                }
              }
            } else {
              if (edgeDefinition.type === "field") {
                if (idOrIds !== void 0) {
                  throw new Error("Cannot set 1:many edge from many end.");
                }
              } else {
                const requested = new Set(idOrIds ?? []);
                const removeEdges = (await this.ctx.db.query(edgeDefinition.table).withIndex(
                  edgeDefinition.field,
                  (q) => q.eq(edgeDefinition.field, docId)
                ).collect()).map((doc) => [doc._id, doc[edgeDefinition.ref]]).concat(
                  edgeDefinition.symmetric ? (await this.ctx.db.query(edgeDefinition.table).withIndex(
                    edgeDefinition.ref,
                    (q) => q.eq(edgeDefinition.ref, docId)
                  ).collect()).map(
                    (doc) => [doc._id, doc[edgeDefinition.field]]
                  ) : []
                ).filter(([_edgeId, otherId]) => {
                  if (requested.has(otherId)) {
                    requested.delete(otherId);
                    return false;
                  }
                  return true;
                }).map(([edgeId]) => edgeId);
                edges[key] = {
                  add: idOrIds ?? [],
                  removeEdges
                };
              }
            }
          })
        );
        await this.base.writeEdges(docId, edges);
        return docId;
      }
    );
  }
  async delete() {
    const { id: docId } = await this.retrieve();
    const id = docId;
    return this.base.deleteId(id, "default");
  }
};
var PromiseEntIdImpl = class extends Promise {
  constructor(ctx, entDefinitions, table, retrieve) {
    super(() => {
    });
    this.ctx = ctx;
    this.entDefinitions = entDefinitions;
    this.table = table;
    this.retrieve = retrieve;
  }
  get() {
    return new PromiseEntWriterImpl(
      this.ctx,
      this.entDefinitions,
      this.table,
      async () => {
        const id = await this.retrieve();
        return { id, doc: async () => this.ctx.db.get(id) };
      },
      true
    );
  }
  then(onfulfilled, onrejected) {
    return this.retrieve().then(onfulfilled, onrejected);
  }
};
var nullRetriever = {
  id: null,
  doc: async () => null
};
function loadedRetriever(doc) {
  return {
    id: doc?._id ?? null,
    doc: async () => doc
  };
}
function addEntRules(entDefinitions, rules) {
  return { ...entDefinitions, rules };
}
async function takeFromQuery(query, n, ctx, entDefinitions, table, mapToResult) {
  if (query === null) {
    return null;
  }
  const readPolicy = getReadRule(entDefinitions, table);
  if (readPolicy === void 0) {
    const results = await query.take(n);
    if (mapToResult === void 0) {
      return results;
    }
    return Promise.all(results.map(mapToResult));
  }
  let numItems = n;
  const docs = [];
  let hasMore = true;
  const iterator = query[Symbol.asyncIterator]();
  while (hasMore && docs.length < n) {
    const page = [];
    for (let i = 0; i < numItems; i++) {
      const { done, value } = await iterator.next();
      if (done) {
        hasMore = false;
        break;
      }
      page.push(mapToResult === void 0 ? value : await mapToResult(value));
    }
    docs.push(
      ...(await filterByReadRule(
        ctx,
        entDefinitions,
        table,
        page,
        false
      )).slice(0, n - docs.length)
    );
    numItems = Math.min(64, numItems * 2);
  }
  return docs;
}
async function filterByReadRule(ctx, entDefinitions, table, docs, throwIfNull) {
  if (docs === null) {
    return null;
  }
  const readPolicy = getReadRule(entDefinitions, table);
  if (readPolicy === void 0) {
    return docs;
  }
  const decisions = await Promise.all(
    docs.map(async (doc) => {
      const decision = await readPolicy(
        entWrapper(doc, ctx, entDefinitions, table)
      );
      if (throwIfNull && !decision) {
        throw new Error(
          `Document cannot be read with id \`${doc._id}\` in table "${table}"`
        );
      }
      return decision;
    })
  );
  return docs.filter((_, i) => decisions[i]);
}
function getIndexFields(entDefinitions, table, index) {
  return entDefinitions[table].indexes[index];
}
function getReadRule(entDefinitions, table) {
  return entDefinitions.rules?.[table]?.read;
}
function getWriteRule(entDefinitions, table) {
  return entDefinitions.rules?.[table]?.write;
}
function getDeletionConfig(entDefinitions, table) {
  return entDefinitions[table].deletionConfig;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  addEntRules,
  entWrapper,
  entsTableFactory,
  getDeletionConfig,
  getReadRule,
  getWriteRule
});
//# sourceMappingURL=functions.js.map