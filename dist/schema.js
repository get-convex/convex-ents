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

// src/schema.ts
var schema_exports = {};
__export(schema_exports, {
  defineEnt: () => defineEnt,
  defineEntFromTable: () => defineEntFromTable,
  defineEntSchema: () => defineEntSchema,
  defineEntsFromTables: () => defineEntsFromTables,
  edgeCompoundIndexName: () => edgeCompoundIndexName,
  getEntDefinitions: () => getEntDefinitions
});
module.exports = __toCommonJS(schema_exports);
var import_server = require("convex/server");
var import_values = require("convex/values");
function defineEntSchema(schema, options) {
  const tableNames = Object.keys(schema);
  for (const tableName of tableNames) {
    const table = schema[tableName];
    for (const edge of edgeConfigsBeforeDefineSchema(table)) {
      if (
        // Skip inverse edges, we process their forward edges
        edge.cardinality === "multiple" && edge.type === "ref" && (edge.inverse !== void 0 || // symmetric is only set by defineEntSchema,
        // so we already processed the pair
        edge.symmetric !== void 0)
      ) {
        continue;
      }
      const otherTableName = edge.to;
      if (otherTableName.startsWith("_")) {
        if (edge.cardinality !== "single") {
          throw new Error(
            `Many:many edge "${edge.name}" in table "${tableName}" points to a system table "${otherTableName}", but only 1:1 edges can point to system tables`
          );
        }
        if (edge.type !== "field") {
          throw new Error(
            `Edge "${edge.name}" in table "${tableName}" pointing to a system table "${otherTableName}" must store the edge by storing the system document ID. Remove the \`ref\` option.`
          );
        }
        if (edge.deletion === "soft") {
          throw new Error(
            `Edge "${edge.name}" in table "${tableName}" pointing to a system table "${otherTableName}" cannot use soft deletion, because system documents cannot be soft deleted.`
          );
        }
        continue;
      }
      const otherTable = schema[otherTableName];
      if (otherTable === void 0) {
        throw new Error(
          `Edge "${edge.name}" in table "${tableName}" points to an undefined table "${otherTableName}"`
        );
      }
      const isSelfDirected = edge.to === tableName;
      const inverseEdgeCandidates = edgeConfigsBeforeDefineSchema(
        otherTable
      ).filter(canBeInverseEdge(tableName, edge, isSelfDirected));
      if (inverseEdgeCandidates.length > 1) {
        throw new Error(
          `Edge "${edge.name}" in table "${tableName}" has too many potential inverse edges in table "${otherTableName}": ${inverseEdgeCandidates.map((edge2) => `"${edge2.name}"`).join(", ")}`
        );
      }
      const inverseEdge = inverseEdgeCandidates[0];
      if (edge.cardinality === "single" && edge.type === "field" && inverseEdge === void 0) {
        throw new Error(
          `Missing inverse edge in table "${otherTableName}" for edge "${edge.name}" in table "${tableName}"`
        );
      }
      if (edge.cardinality === "single" && edge.type === "ref") {
        if (inverseEdge === void 0) {
          throw new Error(
            `Missing inverse edge in table "${otherTableName}" ${edge.ref !== null ? `with field "${edge.ref}" ` : ""}for edge "${edge.name}" in table "${tableName}"`
          );
        }
        if (inverseEdge.cardinality === "single" && inverseEdge.type === "ref") {
          throw new Error(
            `Both edge "${edge.name}" in table "${inverseEdge.to}" and edge "${inverseEdge.name}" in table "${edge.to}" are marked as references, choose one to store the edge by removing the \`ref\` option.`
          );
        }
        if (inverseEdge.cardinality !== "single" || inverseEdge.type !== "field") {
          throw new Error(
            `Unexpected inverse edge type ${edge.name}, ${inverseEdge?.name}`
          );
        }
        if (edge.ref === null) {
          edge.ref = inverseEdge.field;
        }
        inverseEdge.unique = true;
      }
      if (edge.cardinality === "single" || edge.cardinality === "multiple" && edge.type === "field") {
        if (edge.deletion !== void 0 && deletionConfigFromEntDefinition(otherTable) === void 0) {
          throw new Error(
            `Cannot specify soft deletion behavior for edge "${edge.name}" in table "${tableName}" because the target table "${otherTableName}" does not have a "soft" or "scheduled" deletion behavior configured.`
          );
        }
      }
      if (edge.cardinality === "multiple") {
        if (!isSelfDirected && inverseEdge === void 0) {
          throw new Error(
            `Missing inverse edge in table "${otherTableName}" for edge "${edge.name}" in table "${tableName}"`
          );
        }
        if (inverseEdge?.cardinality === "single") {
          if (inverseEdge.type === "ref") {
            throw new Error(
              `The edge "${inverseEdge.name}" in table "${otherTableName}" specified \`ref\`, but it must store the 1:many edge as a field. Check the its inverse edge "${edge.name}" in table "${tableName}".`
            );
          }
          if (edge.type === "ref") {
            throw new Error(
              `The edge "${inverseEdge.name}" in table "${otherTableName}" cannot be singular, as the edge "${edge.name}" in table "${tableName}" did not specify the \`ref\` option.`
            );
          }
          edge.type = "field";
          edge.ref = inverseEdge.field;
        }
        if (inverseEdge?.cardinality === "multiple" || isSelfDirected) {
          if (!isSelfDirected && edge?.type === "field") {
            throw new Error(
              `The edge "${edge.name}" in table "${tableName}" specified \`ref\`, but its inverse edge "${inverseEdge.name}" in table "${otherTableName}" is not the singular end of a 1:many edge.`
            );
          }
          if (inverseEdge?.type === "field") {
            throw new Error(
              `The edge "${inverseEdge.name}" in table "${otherTableName}" specified \`ref\`, but its inverse edge "${edge.name}" in table "${tableName}" is not the singular end of a 1:many edge.`
            );
          }
          const edgeTableName = edge.type === "ref" && edge.table !== void 0 ? edge.table : inverseEdge === void 0 ? `${tableName}_${edge.name}` : inverseEdge.name !== tableName ? `${tableName}_${inverseEdge.name}_to_${edge.name}` : `${inverseEdge.name}_to_${edge.name}`;
          const forwardId = edge.type === "ref" && edge.field !== void 0 ? edge.field : inverseEdge === void 0 ? "aId" : tableName === otherTableName ? inverseEdge.name + "Id" : tableName + "Id";
          const inverseId = isSelfDirected && edge.type === "ref" && edge.inverseField !== void 0 ? edge.inverseField : inverseEdge === void 0 ? "bId" : inverseEdge.type === "ref" && inverseEdge.field !== void 0 ? inverseEdge.field : tableName === otherTableName ? edge.name + "Id" : otherTableName + "Id";
          const edgeTable = defineEnt({
            [forwardId]: import_values.v.id(tableName),
            [inverseId]: import_values.v.id(otherTableName)
          }).index(forwardId, [forwardId]).index(inverseId, [inverseId]).index(edgeCompoundIndexNameRaw(forwardId, inverseId), [
            forwardId,
            inverseId
          ]);
          const isSymmetric = inverseEdge === void 0;
          if (!isSymmetric) {
            edgeTable.index(edgeCompoundIndexNameRaw(inverseId, forwardId), [
              inverseId,
              forwardId
            ]);
          }
          schema[edgeTableName] = edgeTable;
          const edgeConfig = edge;
          edgeConfig.type = "ref";
          edgeConfig.table = edgeTableName;
          edgeConfig.field = forwardId;
          edgeConfig.ref = inverseId;
          edgeConfig.symmetric = inverseEdge === void 0;
          if (inverseEdge !== void 0) {
            inverseEdge.type = "ref";
            const inverseEdgeConfig = inverseEdge;
            inverseEdgeConfig.table = edgeTableName;
            inverseEdgeConfig.field = inverseId;
            inverseEdgeConfig.ref = forwardId;
            inverseEdgeConfig.symmetric = false;
          }
        }
      }
    }
  }
  return (0, import_server.defineSchema)(schema, options);
}
function edgeCompoundIndexName(edgeDefinition) {
  return edgeCompoundIndexNameRaw(edgeDefinition.field, edgeDefinition.ref);
}
function edgeCompoundIndexNameRaw(idA, idB) {
  return `${idA}_${idB}`;
}
function canBeInverseEdge(tableName, edge, isSelfDirected) {
  return (candidate) => {
    if (candidate.to !== tableName) {
      return false;
    }
    if (isSelfDirected) {
      return candidate.cardinality === "multiple" && candidate.type === "ref" && candidate.inverse === edge.name;
    }
    if (edge.cardinality === "single" && edge.type === "ref" && edge.ref !== null || edge.cardinality === "multiple" && edge.type === "field" && edge.ref !== true) {
      if (candidate.cardinality === "single" && candidate.type === "field") {
        return edge.ref === candidate.field;
      }
    }
    if (edge.cardinality === "single" && edge.type === "field" && edge.field !== null) {
      if (candidate.cardinality === "single" && candidate.type === "ref" && candidate.ref !== null || candidate.cardinality === "multiple" && candidate.type === "field" && candidate.ref !== true) {
        return edge.field === candidate.ref;
      }
    }
    if (edge.cardinality === "multiple" && edge.type === "ref" && edge.table !== void 0) {
      return candidate.cardinality === "multiple" && candidate.type === "ref" && edge.table === candidate.table;
    }
    if (candidate.cardinality === "multiple" && candidate.type === "ref" && candidate.table !== void 0) {
      return edge.cardinality === "multiple" && edge.type === "ref" && edge.table === candidate.table;
    }
    return true;
  };
}
function edgeConfigsBeforeDefineSchema(table) {
  return Object.values(
    table.edgeConfigs
  );
}
function deletionConfigFromEntDefinition(table) {
  return table.deletionConfig;
}
function defineEnt(documentSchema) {
  return new EntDefinitionImpl(documentSchema);
}
function defineEntFromTable(definition) {
  const validator = definition.validator;
  if (validator.kind !== "object") {
    throw new Error(
      "Only tables with object definition are supported in Ents, not unions"
    );
  }
  const entDefinition = defineEnt(validator.fields);
  entDefinition.indexes = definition.indexes;
  entDefinition.searchIndexes = definition.searchIndexes;
  entDefinition.vectorIndexes = definition.vectorIndexes;
  return entDefinition;
}
function defineEntsFromTables(definitions) {
  const result = {};
  for (const key in definitions) {
    result[key] = defineEntFromTable(definitions[key]);
  }
  return result;
}
var EntDefinitionImpl = class {
  validator;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  indexes = [];
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  searchIndexes = [];
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  vectorIndexes = [];
  documentSchema;
  edgeConfigs = {};
  fieldConfigs = {};
  defaults = {};
  deletionConfig;
  constructor(documentSchema) {
    this.documentSchema = documentSchema;
    this.validator = import_values.v.object(documentSchema);
  }
  index(name, fields) {
    this.indexes.push({ indexDescriptor: name, fields });
    return this;
  }
  searchIndex(name, indexConfig) {
    this.searchIndexes.push({
      indexDescriptor: name,
      searchField: indexConfig.searchField,
      filterFields: indexConfig.filterFields || []
    });
    return this;
  }
  vectorIndex(name, indexConfig) {
    this.vectorIndexes.push({
      indexDescriptor: name,
      vectorField: indexConfig.vectorField,
      dimensions: indexConfig.dimensions,
      filterFields: indexConfig.filterFields || []
    });
    return this;
  }
  /**
   * Export the contents of this definition.
   *
   * This is called internally by the Convex framework.
   * @internal
   */
  export() {
    return {
      indexes: this.indexes,
      searchIndexes: this.searchIndexes,
      vectorIndexes: this.vectorIndexes,
      documentType: import_values.v.object(this.documentSchema).json
    };
  }
  field(name, validator, options) {
    const finalValidator = options?.default !== void 0 ? import_values.v.optional(validator) : validator;
    this.documentSchema[name] = finalValidator;
    if (options?.unique === true || options?.index === true) {
      this.indexes = this.indexes.filter((idx) => idx.indexDescriptor !== name);
      this.indexes.push({ indexDescriptor: name, fields: [name] });
    }
    if (options?.default !== void 0) {
      this.defaults[name] = options.default;
    } else {
      delete this.defaults[name];
    }
    if (options?.unique === true) {
      this.fieldConfigs[name] = { name, unique: true };
    } else {
      delete this.fieldConfigs[name];
    }
    return this;
  }
  edge(edgeName, options) {
    if (this.edgeConfigs[edgeName] !== void 0) {
      throw new Error(`Duplicate edge "${edgeName}"`);
    }
    const to = options?.to ?? edgeName + "s";
    if (options?.field !== void 0 && options?.ref !== void 0) {
      throw new Error(
        `Cannot specify both \`field\` and \`ref\` for the same edge, choose one to be the reference and the other to store the foreign key.`
      );
    }
    if (options?.field !== void 0 || options?.ref === void 0) {
      const fieldName = options?.field ?? edgeName + "Id";
      this.documentSchema = {
        ...this.documentSchema,
        [fieldName]: options?.optional === true ? import_values.v.optional(import_values.v.id(to)) : import_values.v.id(to)
      };
      this.edgeConfigs[edgeName] = {
        name: edgeName,
        to,
        cardinality: "single",
        type: "field",
        field: fieldName,
        optional: options?.optional === true,
        deletion: options?.deletion
      };
      this.indexes.push({
        indexDescriptor: fieldName,
        fields: [fieldName]
      });
      return this;
    }
    this.edgeConfigs[edgeName] = {
      name: edgeName,
      to,
      cardinality: "single",
      type: "ref",
      ref: options.ref === true ? null : options.ref,
      deletion: options.deletion
    };
    return this;
  }
  edges(name, options) {
    const cardinality = "multiple";
    const to = options?.to ?? name;
    const ref = options?.ref;
    const table = options?.table;
    if (ref !== void 0 && table !== void 0) {
      throw new Error(
        `Cannot specify both \`ref\` and \`table\` for the same edge, as the former is for 1:many edges and the latter for many:many edges. Config: \`${JSON.stringify(options)}\``
      );
    }
    const field = options?.field;
    const inverseField = options?.inverseField;
    if ((field !== void 0 || inverseField !== void 0) && table === void 0) {
      throw new Error(
        `Specify \`table\` if you're customizing the \`field\` or \`inverseField\` for a many:many edge. Config: \`${JSON.stringify(options)}\``
      );
    }
    const inverseName = options?.inverse;
    const deletion = options?.deletion;
    this.edgeConfigs[name] = ref !== void 0 ? { name, to, cardinality, type: "field", ref, deletion } : { name, to, cardinality, type: "ref", table, field, inverseField };
    if (inverseName !== void 0) {
      this.edgeConfigs[inverseName] = {
        name: inverseName,
        to,
        cardinality,
        type: "ref",
        inverse: name,
        table
      };
    }
    return this;
  }
  deletion(type, options) {
    if (this.documentSchema.deletionTime !== void 0) {
      throw new Error(
        `Cannot enable "${type}" deletion because "deletionTime" field was already defined.`
      );
    }
    if (this.deletionConfig !== void 0) {
      throw new Error(`Deletion behavior can only be specified once.`);
    }
    this.documentSchema = {
      ...this.documentSchema,
      deletionTime: import_values.v.optional(import_values.v.number())
    };
    this.deletionConfig = { type, ...options };
    return this;
  }
};
function getEntDefinitions(schema) {
  const tables = schema.tables;
  return Object.entries(tables).reduce(
    (acc, [tableName, table]) => {
      acc[tableName] = {
        indexes: table.indexes.reduce(
          (acc2, { indexDescriptor, fields }) => {
            acc2[indexDescriptor] = fields;
            return acc2;
          },
          {}
        ),
        defaults: table.defaults,
        edges: table.edgeConfigs,
        fields: table.fieldConfigs,
        deletionConfig: table.deletionConfig
      };
      return acc;
    },
    {}
  );
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  defineEnt,
  defineEntFromTable,
  defineEntSchema,
  defineEntsFromTables,
  edgeCompoundIndexName,
  getEntDefinitions
});
//# sourceMappingURL=schema.js.map