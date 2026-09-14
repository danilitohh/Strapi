import assert from "node:assert/strict";
import test from "node:test";
import type { AppConfig } from "../src/config.js";
import { StrapiClient } from "../src/strapi-client.js";

// Configuración mínima para probar únicamente las peticiones del cliente.
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

test("el PUT del producto envía exclusivamente data.seo", async () => {
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

test("consulta Strapi en modo preview para incluir productos Draft", async () => {
  let requestedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ data: [], meta: { pagination: { page: 1, pageCount: 1 } } }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    await new StrapiClient(config).getPage(1, "es-GT");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(new URL(requestedUrl).searchParams.get("publicationState"), "preview");
});

test("busca por slug exacto y locale en modo preview", async () => {
  let requestedUrl = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({ data: [{ id: 5 }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    const result = await new StrapiClient(config).findProductBySlug("doctorado-programa", "es-GT");
    assert.deepEqual(result, { id: 5 });
  } finally {
    globalThis.fetch = originalFetch;
  }

  const query = new URL(requestedUrl).searchParams;
  assert.equal(query.get("locale"), "es-GT");
  assert.equal(query.get("filters[slug][$eq]"), "doctorado-programa");
  assert.equal(query.get("publicationState"), "preview");
});
