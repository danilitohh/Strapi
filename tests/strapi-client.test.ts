import assert from "node:assert/strict";
import test from "node:test";
import type { AppConfig } from "../src/config.js";
import { StrapiClient } from "../src/strapi-client.js";

test("el PUT del producto envía exclusivamente data.seo", async () => {
  const config: AppConfig = {
    token: "token-de-prueba",
    baseUrl: "https://strapi.example",
    productsPath: "/api/products",
    locale: "es-MX",
    pageSize: 100,
    maxProducts: null,
    slugPath: "slug",
    hrefLangsPath: "seo.MultipleHrefLangs",
    populateQuery: "populate[seo][populate]=*",
    timeoutMs: 12000,
    concurrency: 1
  };
  const replacement = [
    { hrefLang: "es-mx", url: "https://utel.edu.mx/programa", locale: "", rel: "alternate" }
  ];
  let putBody: unknown;
  let putUrl = "";
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (init?.method === "PUT") {
      putUrl = url;
      putBody = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ data: { id: 25 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      data: {
        id: 25,
        attributes: {
          slug: "programa",
          title: "Título del producto",
          publishedAt: "2026-09-11T00:00:00.000Z",
          category: { data: { id: 800, attributes: { name: "Categoría" } } },
          seo: {
            id: 91,
            MetaTitle: "Título SEO",
            MetaDescription: "Descripción SEO",
            MetaImage: { data: { id: 3722, attributes: { name: "imagen.webp" } } },
            MultipleHrefLangs: []
          }
        }
      }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const client = new StrapiClient(config);
    await client.updateProductHrefLangs(25, "es-MX", config.hrefLangsPath, replacement);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(putUrl, "https://strapi.example/api/products/25?locale=es-MX");
  assert.deepEqual(putBody, {
    data: {
      seo: {
        id: 91,
        MetaTitle: "Título SEO",
        MetaDescription: "Descripción SEO",
        MetaImage: 3722,
        MultipleHrefLangs: replacement
      }
    }
  });
  const sentData = (putBody as { data: Record<string, unknown> }).data;
  assert.deepEqual(Object.keys(sentData), ["seo"]);
  for (const forbiddenField of ["slug", "title", "publishedAt", "category"]) {
    assert.equal(Object.prototype.hasOwnProperty.call(sentData, forbiddenField), false);
  }
});
