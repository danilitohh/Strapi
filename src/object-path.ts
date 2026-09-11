import { isDeepStrictEqual } from "node:util";
import type { JsonObject } from "./types.js";

export function getAtPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as JsonObject)[key];
  }, source);
}

export function setAtPath(source: JsonObject, path: string, value: unknown): JsonObject {
  const keys = path.split(".");
  const root: JsonObject = { ...source };
  let output = root;
  let input: unknown = source;

  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      output[key] = value;
      return;
    }
    const inputChild = input && typeof input === "object" ? (input as JsonObject)[key] : undefined;
    const outputChild: JsonObject = inputChild && typeof inputChild === "object" && !Array.isArray(inputChild)
      ? { ...(inputChild as JsonObject) }
      : {};
    output[key] = outputChild;
    output = outputChild;
    input = inputChild;
  });

  return root;
}

export function topLevelBranch(source: JsonObject, path: string, value: unknown): JsonObject {
  const updated = setAtPath(source, path, value);
  const topKey = path.split(".")[0];
  return { [topKey]: updated[topKey] };
}

export function strictTopLevelBranch(source: JsonObject, path: string, value: unknown): JsonObject {
  const topKey = path.split(".")[0];
  if (!Object.prototype.hasOwnProperty.call(source, topKey)) {
    throw new Error(`Actualización cancelada: Strapi no devolvió la rama ${topKey}`);
  }

  const payload = topLevelBranch(source, path, value);
  const marker = Symbol("allowed-change");
  const originalWithoutAllowedChange = setAtPath({ [topKey]: source[topKey] }, path, marker);
  const payloadWithoutAllowedChange = setAtPath(payload, path, marker);

  if (
    Object.keys(payload).length !== 1
    || !Object.prototype.hasOwnProperty.call(payload, topKey)
    || !isDeepStrictEqual(originalWithoutAllowedChange, payloadWithoutAllowedChange)
  ) {
    throw new Error(`Actualización cancelada: el payload modificaría datos fuera de ${path}`);
  }

  return payload;
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mediaIdentifier(value: unknown, fieldPath: string): string | number | null {
  if (value === null) return null;
  if (!isJsonObject(value)) {
    if (typeof value === "string" || typeof value === "number") return value;
    throw new Error(`Actualización cancelada: ${fieldPath} no tiene un formato de imagen válido`);
  }

  const relationData = Object.prototype.hasOwnProperty.call(value, "data") ? value.data : value;
  if (relationData === null) return null;
  if (!isJsonObject(relationData)) {
    throw new Error(`Actualización cancelada: ${fieldPath} no contiene una imagen individual válida`);
  }

  const identifier = relationData.documentId ?? relationData.id;
  if (typeof identifier !== "string" && typeof identifier !== "number") {
    throw new Error(`Actualización cancelada: ${fieldPath} tiene una imagen sin id`);
  }
  return identifier;
}

function prepareComponentForWrite(value: unknown, fieldPath: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => prepareComponentForWrite(item, `${fieldPath}[${index}]`));
  }
  if (!isJsonObject(value)) return value;

  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    const childPath = fieldPath ? `${fieldPath}.${key}` : key;
    if (key.toLowerCase() === "metaimage") {
      return [key, mediaIdentifier(child, childPath)];
    }
    return [key, prepareComponentForWrite(child, childPath)];
  }));
}

/**
 * Builds a Strapi component update while preserving every sibling field.
 * Populated MetaImage relations are converted from their read representation
 * ({ data: { id, attributes } }) to the media id expected by Strapi on writes.
 */
export function safeComponentUpdatePayload(source: JsonObject, path: string, value: unknown): JsonObject {
  const payload = strictTopLevelBranch(source, path, value);
  const topKey = path.split(".")[0];
  return { [topKey]: prepareComponentForWrite(payload[topKey], topKey) };
}

