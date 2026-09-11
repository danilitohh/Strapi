import pLimit from "p-limit";
import { buildUrl, createHrefLang, MAX_HREFLANGS, TARGETS } from "./countries.js";
import type { AppConfig } from "./config.js";
import { isAvailable } from "./http.js";
import { getAtPath } from "./object-path.js";
import { StrapiClient } from "./strapi-client.js";
import type { HrefLang, JsonObject, ProductResult } from "./types.js";

export function normalizeExistingHrefLangs(items: HrefLang[]): HrefLang[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (typeof item.hrefLang !== "string" || !item.hrefLang.trim()) return false;
    const code = item.hrefLang.trim().toLowerCase();
    if (seen.has(code)) return false;
    seen.add(code);
    return true;
  });
}

function attributesOf(product: JsonObject): JsonObject {
  const attributes = product.attributes;
  return attributes && typeof attributes === "object" && !Array.isArray(attributes)
    ? attributes as JsonObject
    : product;
}

function identifierOf(product: JsonObject): string | number {
  const identifier = product.documentId ?? product.id;
  if (typeof identifier !== "string" && typeof identifier !== "number") {
    throw new Error("Producto sin documentId ni id");
  }
  return identifier;
}

export async function processProduct(
  client: StrapiClient,
  config: AppConfig,
  product: JsonObject,
  apply: boolean
): Promise<ProductResult> {
  const attributes = attributesOf(product);
  const identifier = identifierOf(product);
  const slugValue = getAtPath(attributes, config.slugPath);
  if (typeof slugValue !== "string" || !slugValue.trim()) throw new Error(`Producto ${identifier} sin slug válido`);
  const slug = slugValue.trim().replace(/^\/+|\/+$/g, "");
  const productName = getAtPath(attributes, "title");
  const siuKey = getAtPath(attributes, "siuKey");
  const reportInfo = {
    productName: typeof productName === "string" ? productName : slug,
    siuKey: typeof siuKey === "string" || typeof siuKey === "number" ? String(siuKey) : ""
  };
  const currentValue = getAtPath(attributes, config.hrefLangsPath);
  const rawExisting = Array.isArray(currentValue) ? currentValue as HrefLang[] : [];
  const existing = normalizeExistingHrefLangs(rawExisting);
  const removedInvalidCount = rawExisting.length - existing.length;

  if (existing.length >= MAX_HREFLANGS && removedInvalidCount === 0) {
    return { identifier, slug, ...reportInfo, existingCount: existing.length, removedInvalidCount, added: [], unavailable: [], action: "skipped-complete" };
  }

  const existingCodes = new Set(existing.map(item => String(item.hrefLang ?? "").toLowerCase()));
  const missing = TARGETS.filter(target => !existingCodes.has(target.hreflang));
  const limit = pLimit(config.concurrency);
  const checks = await Promise.all(missing.map(target => limit(async () => {
    const url = buildUrl(target, slug);
    return { target, url, available: await isAvailable(url, config.timeoutMs) };
  })));

  const additions = checks
    .filter(check => check.available)
    .slice(0, Math.max(0, MAX_HREFLANGS - existing.length))
    .map(check => createHrefLang(check.target.hreflang, check.url));
  const unavailable = checks.filter(check => !check.available).map(({ target, url }) => ({ hreflang: target.hreflang, url }));

  if (additions.length === 0 && removedInvalidCount === 0) {
    return { identifier, slug, ...reportInfo, existingCount: existing.length, removedInvalidCount, added: [], unavailable, action: "unchanged" };
  }

  if (apply) {
    await client.updateProductHrefLangs(identifier, config.locale, config.hrefLangsPath, [...existing, ...additions]);
  }

  return {
    identifier,
    slug,
    ...reportInfo,
    existingCount: existing.length,
    removedInvalidCount,
    added: additions,
    unavailable,
    action: apply ? "updated" : "would-update"
  };
}

