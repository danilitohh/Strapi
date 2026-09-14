import pLimit from "p-limit";
import { buildUrl, createHrefLang, TARGETS, MAX_HREFLANGS } from "./countries.js";
import type { AppConfig } from "./config.js";
import { getAtPath } from "./object-path.js";
import { StrapiClient } from "./strapi-client.js";
import type { HrefLang, JsonObject, SyncResult } from "./types.js";

type ProductRecord = { product: JsonObject; locale: string; slug: string };
type Unavailable = { hreflang: string; reason: string };

const CAREER_LOCALES = new Set(["es-cl", "es-bo", "es-co", "es-ec", "es-py", "es-pe"]);
const COUNTRY_TARGETS = TARGETS.filter(target => target.hreflang.startsWith("es-"));

/** Convierte es-us a es-US, que es el formato usado por el locale de Strapi. */
function strapiLocale(locale: string): string {
  return locale.replace(/-([a-z]{2})$/i, (_, country: string) => `-${country.toUpperCase()}`);
}

/** Obtiene attributes tanto de respuestas Strapi v4 como de objetos planos. */
function attributesOf(product: JsonObject): JsonObject {
  const attributes = product.attributes;
  return attributes && typeof attributes === "object" && !Array.isArray(attributes)
    ? attributes as JsonObject
    : product;
}

/** Obtiene el identificador que Strapi necesita para actualizar un producto. */
function identifierOf(product: JsonObject): string | number {
  const identifier = product.documentId ?? product.id;
  if (typeof identifier !== "string" && typeof identifier !== "number") {
    throw new Error("Producto sin documentId ni id");
  }
  return identifier;
}

/** Genera variantes de slug para las palabras que cambian por país. */
function slugCandidates(slug: string, locale: string): string[] {
  const candidates = [slug];
  const addSwap = (from: RegExp, to: string) => {
    const candidate = slug.replace(from, to);
    if (candidate !== slug && !candidates.includes(candidate)) candidates.push(candidate);
  };

  if (CAREER_LOCALES.has(locale)) {
    if (/^licenciatura(?=-|$)/i.test(slug)) addSwap(/^licenciatura(?=-|$)/i, "carrera");
  } else if (/^carrera(?=-|$)/i.test(slug)) {
    addSwap(/^carrera(?=-|$)/i, "licenciatura");
  }

  if (locale === "es-cl") {
    if (/^maestria(?=-|$)/i.test(slug)) addSwap(/^maestria(?=-|$)/i, "magister");
  } else if (/^magister(?=-|$)/i.test(slug)) {
    addSwap(/^magister(?=-|$)/i, "maestria");
  }
  return candidates;
}

/** Devuelve el slug real del producto encontrado en el locale consultado. */
function slugOf(product: JsonObject, fallback: string, slugPath: string): string {
  const value = getAtPath(attributesOf(product), slugPath);
  return typeof value === "string" && value.trim()
    ? value.trim().replace(/^\/+|\/+$/g, "")
    : fallback;
}

/** Busca el producto equivalente sin modificar el locale consultado. */
async function findEquivalent(
  client: StrapiClient,
  source: ProductRecord,
  targetLocale: string,
  slugPath: string
): Promise<ProductRecord | undefined> {
  const apiLocale = strapiLocale(targetLocale);
  for (const candidate of slugCandidates(source.slug, targetLocale)) {
    const product = await client.findProductBySlug(candidate, apiLocale);
    if (product) return { product, locale: apiLocale, slug: slugOf(product, candidate, slugPath) };
  }
  return undefined;
}

/** Lee el valor actual sin normalizarlo ni eliminar entradas existentes. */
function currentHrefLangs(attributes: JsonObject, path: string): HrefLang[] {
  const value = getAtPath(attributes, path);
  return Array.isArray(value) ? value as HrefLang[] : [];
}

/** Detecta datos inválidos que no deben borrarse automáticamente. */
function invalidHrefLangIndex(items: HrefLang[]): number {
  return items.findIndex(item => !item || typeof item !== "object" || typeof item.hrefLang !== "string" || !item.hrefLang.trim());
}

/** Devuelve solo los hreflangs que faltan, conservando el orden y contenido actuales. */
function additionsOnly(existing: HrefLang[], desired: HrefLang[]): HrefLang[] {
  const existingCodes = new Set(
    existing
      .filter(item => typeof item.hrefLang === "string")
      .map(item => item.hrefLang.trim().toLowerCase())
  );
  return desired
    .filter(item => !existingCodes.has(item.hrefLang.toLowerCase()))
    .slice(0, Math.max(0, MAX_HREFLANGS - existing.length));
}

/** Construye todos los enlaces válidos; x-default copia exactamente es-us. */
function desiredHrefLangs(matches: Map<string, ProductRecord>, unavailable: Unavailable[]): HrefLang[] {
  const result: HrefLang[] = [];
  const usMatch = matches.get("es-us");

  if (usMatch) {
    const usTarget = TARGETS.find(target => target.hreflang === "es-us")!;
    // Se reutiliza la misma URL calculada para es-us, sin reconstruir una URL distinta.
    const usUrl = buildUrl(usTarget, usMatch.slug);
    result.push(createHrefLang("x-default", usUrl));
  } else {
    unavailable.unshift({ hreflang: "x-default", reason: "No existe producto equivalente en es-us" });
  }

  result.push(...Array.from(matches.entries()).map(([hreflang, match]) => {
    const target = TARGETS.find(item => item.hreflang === hreflang)!;
    return createHrefLang(hreflang, buildUrl(target, match.slug));
  }));
  return result;
}

/**
 * Procesa únicamente el locale configurado. Los otros locales solo se
 * consultan individualmente para confirmar si existe cada producto, incluso
 * en Draft; jamás se actualizan desde esta función.
 */
export async function synchronizeProducts(client: StrapiClient, config: AppConfig, apply: boolean): Promise<SyncResult[]> {
  const workLocale = strapiLocale(config.locale);
  const sourceProducts: ProductRecord[] = [];

  // Esta es la única lectura paginada: limita el trabajo al locale elegido.
  for await (const product of client.allProducts(workLocale)) {
    const attributes = attributesOf(product);
    const slug = getAtPath(attributes, config.slugPath);
    if (typeof slug === "string" && slug.trim()) {
      sourceProducts.push({ product, locale: workLocale, slug: slug.trim().replace(/^\/+|\/+$/g, "") });
    } else {
      console.warn(`[omitido] ${workLocale}: producto sin slug válido`);
    }
  }

  const limitedProducts = config.maxProducts ? sourceProducts.slice(0, config.maxProducts) : sourceProducts;
  const results: SyncResult[] = [];
  const lookupLimit = pLimit(config.concurrency);

  for (const source of limitedProducts) {
    try {
      const checks = await Promise.all(COUNTRY_TARGETS.map(target => lookupLimit(async () => ({
        target,
        match: target.hreflang === config.locale.toLowerCase()
          ? source
          : await findEquivalent(client, source, target.hreflang, config.slugPath)
      }))));
      const matches = new Map<string, ProductRecord>();
      const unavailable: Unavailable[] = [];
      for (const check of checks) {
        if (check.match) matches.set(check.target.hreflang, check.match);
        else unavailable.push({ hreflang: check.target.hreflang, reason: "No existe producto equivalente en Strapi" });
      }

      const desired = desiredHrefLangs(matches, unavailable);
      const attributes = attributesOf(source.product);
      const existing = currentHrefLangs(attributes, config.hrefLangsPath);
      const invalidIndex = invalidHrefLangIndex(existing);
      const identifier = identifierOf(source.product);
      const productName = getAtPath(attributes, "title");
      const siuKey = getAtPath(attributes, "siuKey");
      const baseResult = {
        identifier,
        locale: source.locale,
        slug: source.slug,
        productName: typeof productName === "string" ? productName : source.slug,
        siuKey: typeof siuKey === "string" || typeof siuKey === "number" ? String(siuKey) : ""
      };

      if (invalidIndex >= 0) {
        results.push({ ...baseResult, hrefLangs: existing, added: [], unavailable, action: "error", error: `Actualización cancelada: MultipleHrefLangs[${invalidIndex}] tiene hrefLang inválido y no se eliminará automáticamente` });
        continue;
      }

      const additions = additionsOnly(existing, desired);
      if (additions.length === 0) {
        results.push({ ...baseResult, hrefLangs: existing, added: [], unavailable, action: "unchanged" });
        continue;
      }

      // El payload final conserva cada entrada existente y solo agrega las nuevas.
      const resultingHrefLangs = [...existing, ...additions];
      if (apply) await client.updateProductHrefLangs(identifier, source.locale, config.hrefLangsPath, resultingHrefLangs);
      results.push({ ...baseResult, hrefLangs: resultingHrefLangs, added: additions, unavailable, action: apply ? "updated" : "would-update" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ identifier: identifierOf(source.product), locale: source.locale, slug: source.slug, productName: source.slug, siuKey: "", hrefLangs: [], added: [], unavailable: [], action: "error", error: message });
      console.error(`[error] ${source.slug}: ${message}`);
    }
  }
  return results;
}
