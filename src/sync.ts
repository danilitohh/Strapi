import { buildUrl, createHrefLang, TARGETS } from "./countries.js";
import type { AppConfig } from "./config.js";
import { getAtPath, setAtPath } from "./object-path.js";
import { StrapiClient } from "./strapi-client.js";
import type { HrefLang, JsonObject, SyncResult } from "./types.js";

type ProductRecord = { product: JsonObject; locale: string; slug: string };

const CAREER_LOCALES = new Set(["es-cl", "es-bo", "es-co", "es-ec", "es-py", "es-pe"]);

function strapiLocale(locale: string): string {
  return locale.replace(/-([a-z]{2})$/i, (_, country: string) => `-${country.toUpperCase()}`);
}

function attributesOf(product: JsonObject): JsonObject {
  const attributes = product.attributes;
  return attributes && typeof attributes === "object" && !Array.isArray(attributes)
    ? attributes as JsonObject
    : product;
}

function identifierOf(product: JsonObject): string | number {
  const identifier = product.documentId ?? product.id;
  if (typeof identifier !== "string" && typeof identifier !== "number") throw new Error("Producto sin documentId ni id");
  return identifier;
}

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

function productMap(products: ProductRecord[]): Map<string, ProductRecord> {
  return new Map(products.map(product => [product.slug.toLowerCase(), product]));
}

function findEquivalent(source: ProductRecord, targetLocale: string, products: Map<string, ProductRecord>): ProductRecord | undefined {
  return slugCandidates(source.slug, targetLocale)
    .map(candidate => products.get(candidate.toLowerCase()))
    .find(Boolean);
}

function hrefLangsEqual(left: HrefLang[], right: HrefLang[]): boolean {
  const normalize = (items: HrefLang[]) => items.map(item => [item.hrefLang, item.url, item.locale ?? "", item.rel ?? "alternate"]);
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

export async function synchronizeProducts(client: StrapiClient, config: AppConfig, apply: boolean): Promise<SyncResult[]> {
  const locales = Array.from(new Set([
    config.locale.toLowerCase(),
    ...TARGETS.filter(target => target.hreflang.startsWith("es-")).map(target => target.hreflang)
  ]));
  const productsByLocale = new Map<string, ProductRecord[]>();

  for (const locale of locales) {
    const apiLocale = strapiLocale(locale);
    const products: ProductRecord[] = [];
    for await (const product of client.allProducts(apiLocale)) {
      const attributes = attributesOf(product);
      const slug = getAtPath(attributes, config.slugPath);
      if (typeof slug === "string" && slug.trim()) products.push({ product, locale: apiLocale, slug: slug.trim().replace(/^\/+|\/+$/g, "") });
      else console.warn(`[omitido] ${apiLocale}: producto sin slug válido`);
    }
    productsByLocale.set(locale, products);
  }

  const sourceProducts = productsByLocale.get(config.locale.toLowerCase()) ?? [];
  const limitedSourceProducts = config.maxProducts ? sourceProducts.slice(0, config.maxProducts) : sourceProducts;
  const results: SyncResult[] = [];

  for (const source of limitedSourceProducts) {
    try {
      const matches = new Map<string, ProductRecord>();
      const unavailable: Array<{ hreflang: string; reason: string }> = [];
      for (const target of TARGETS.filter(item => item.hreflang.startsWith("es-"))) {
        const locale = target.hreflang;
        const match = findEquivalent(source, locale, productMap(productsByLocale.get(locale) ?? []));
        if (match) matches.set(target.hreflang, match);
        else unavailable.push({ hreflang: target.hreflang, reason: "No existe slug equivalente en Strapi" });
      }
      const defaultProduct = matches.get("es-mx") ?? source;
      const hrefLangs = [
        createHrefLang("x-default", buildUrl(TARGETS[0], defaultProduct.slug)),
        ...Array.from(matches.entries()).map(([hreflang, match]) => {
          const target = TARGETS.find(item => item.hreflang === hreflang)!;
          return createHrefLang(hreflang, buildUrl(target, match.slug));
        })
      ];

      for (const match of matches.values()) {
        const attributes = attributesOf(match.product);
        const current = getAtPath(attributes, config.hrefLangsPath);
        const currentHrefLangs = Array.isArray(current) ? current as HrefLang[] : [];
        const changed = !hrefLangsEqual(currentHrefLangs, hrefLangs);
        const identifier = identifierOf(match.product);
        const productName = getAtPath(attributes, "title");
        const siuKey = getAtPath(attributes, "siuKey");
        if (changed && apply) {
          const onlyFieldPayload = setAtPath({}, config.hrefLangsPath, hrefLangs);
          await client.updateProduct(identifier, match.locale, onlyFieldPayload);
        }
        results.push({
          identifier,
          locale: match.locale,
          slug: match.slug,
          productName: typeof productName === "string" ? productName : match.slug,
          siuKey: typeof siuKey === "string" || typeof siuKey === "number" ? String(siuKey) : "",
          hrefLangs,
          added: changed ? hrefLangs : [],
          unavailable,
          action: changed ? (apply ? "updated" : "would-update") : "unchanged"
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ identifier: identifierOf(source.product), locale: source.locale, slug: source.slug, productName: source.slug, siuKey: "", hrefLangs: [], added: [], unavailable: [], action: "error", error: message });
      console.error(`[error] ${source.slug}: ${message}`);
    }
  }
  return results;
}
