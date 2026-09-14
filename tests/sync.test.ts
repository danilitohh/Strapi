import assert from "node:assert/strict";
import test from "node:test";
import type { AppConfig } from "../src/config.js";
import { synchronizeProducts } from "../src/sync.js";
import type { JsonObject } from "../src/types.js";

// Simula un producto publicado o Draft; el sincronizador debe tratarlos igual
// cuando la API los devuelve en modo preview.
function product(id: number, slug: string, publishedAt: string | null): JsonObject {
  return {
    id,
    attributes: {
      slug,
      title: "Doctorado en Alta Dirección y Gobierno Corporativo",
      siuKey: "UTLMABVFED",
      publishedAt,
      seo: { MultipleHrefLangs: [] }
    }
  };
}

test("incluye equivalentes en Draft y hace que x-default copie es-mx", async () => {
  const productsByLocale = new Map<string, JsonObject[]>([
    ["es-US", [
      {
        ...product(1, "doctorado-en-alta-direccion-y-gobierno-corporativo", "2026-09-11"),
        attributes: {
          ...product(1, "doctorado-en-alta-direccion-y-gobierno-corporativo", "2026-09-11").attributes as JsonObject,
          seo: {
            MultipleHrefLangs: [{ hrefLang: "custom", url: "https://ejemplo.test/existente", locale: "", rel: "alternate" }]
          }
        }
      }
    ]],
    ["es-MX", [product(6, "doctorado-en-alta-direccion-y-gobierno-corporativo", "2026-09-11")]],
    ["es-EC", [product(2, "doctorado-en-alta-direccion-y-gobierno-corporativo", null)]],
    ["es-GT", [product(3, "doctorado-en-alta-direccion-y-gobierno-corporativo", null)]],
    ["es-SV", [product(4, "doctorado-en-alta-direccion-y-gobierno-corporativo", null)]]
  ]);
  const updates: Array<{ identifier: string | number; locale: string; body: unknown }> = [];
  const pagedLocales: string[] = [];
  const lookupLocales: string[] = [];
  const fakeClient = {
    async *allProducts(locale: string) {
      pagedLocales.push(locale);
      yield* productsByLocale.get(locale) ?? [];
    },
    async findProductBySlug(slug: string, locale: string) {
      lookupLocales.push(locale);
      return (productsByLocale.get(locale) ?? []).find(item => (item.attributes as JsonObject).slug === slug);
    },
    async updateProductHrefLangs(identifier: string | number, locale: string, _path: string, body: unknown) {
      updates.push({ identifier, locale, body });
    }
  };
  const config = {
    token: "token-de-prueba",
    baseUrl: "https://strapi.example",
    productsPath: "/api/products",
    locale: "es-us",
    pageSize: 100,
    maxProducts: 1,
    slugPath: "slug",
    hrefLangsPath: "seo.MultipleHrefLangs",
    populateQuery: "populate[seo][populate]=*",
    timeoutMs: 12000,
    concurrency: 1
  } as AppConfig;

  const results = await synchronizeProducts(fakeClient as never, config, true);
  assert.deepEqual(pagedLocales, ["es-US"], "solo se pagina el locale configurado");
  assert.ok(lookupLocales.includes("es-EC"));
  assert.ok(lookupLocales.includes("es-GT"));
  assert.ok(lookupLocales.includes("es-SV"));
  const usResult = results.find(result => result.locale === "es-US");
  assert.ok(usResult);
  const mexicoUrl = usResult.hrefLangs.find(item => item.hrefLang === "es-mx")?.url;
  const defaultUrl = usResult.hrefLangs.find(item => item.hrefLang === "x-default")?.url;
  assert.equal(defaultUrl, mexicoUrl);
  assert.equal(updates.length, 1, "solo se actualiza el producto del locale configurado");
  const updatedHrefLangs = updates[0].body as Array<{ hrefLang: string; url: string }>;
  assert.ok(updatedHrefLangs.some(item => item.hrefLang === "es-ec"));
  assert.ok(updatedHrefLangs.some(item => item.hrefLang === "es-gt"));
  assert.ok(updatedHrefLangs.some(item => item.hrefLang === "es-sv"));
  assert.deepEqual(updatedHrefLangs[0], {
    hrefLang: "custom",
    url: "https://ejemplo.test/existente",
    locale: "",
    rel: "alternate"
  }, "la entrada existente se conserva sin cambios");
});
