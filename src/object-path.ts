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

