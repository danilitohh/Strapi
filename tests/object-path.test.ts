import assert from "node:assert/strict";
import test from "node:test";
import { safeComponentUpdatePayload } from "../src/object-path.js";

test("actualiza MultipleHrefLangs sin eliminar los demás campos de SEO", () => {
  const source = {
    slug: "programa",
    title: "Producto que no debe enviarse",
    category: { data: { id: 800, attributes: { name: "Categoría existente" } } },
    seo: {
      id: 91,
      MetaTitle: "Título existente",
      MetaDescription: "Descripción existente",
      PreventIndexing: false,
      StructuredData: [{ name: "Programa", offers: { availability: "InStock" } }],
      priority: 0.5,
      LinkCanonical: "https://utel.edu.mx/programa",
      hrefLang: "es-mx",
      htmlLang: "ES",
      Meta: [{ id: 12, Keywords: "universidad" }],
      MetaImage: {
        data: {
          id: 3722,
          attributes: { name: "imagen.webp", url: "/uploads/imagen.webp" }
        }
      },
      MultipleHrefLangs: [{ id: 1, hrefLang: "es-mx", url: "anterior" }]
    }
  };
  const replacement = [{ hrefLang: "es-mx", url: "https://utel.edu.mx/programa", locale: "", rel: "alternate" }];

  const payload = safeComponentUpdatePayload(source, "seo.MultipleHrefLangs", replacement);

  assert.deepEqual(payload, {
    seo: {
      id: 91,
      MetaTitle: "Título existente",
      MetaDescription: "Descripción existente",
      PreventIndexing: false,
      StructuredData: [{ name: "Programa", offers: { availability: "InStock" } }],
      priority: 0.5,
      LinkCanonical: "https://utel.edu.mx/programa",
      hrefLang: "es-mx",
      htmlLang: "ES",
      Meta: [{ id: 12, Keywords: "universidad" }],
      MetaImage: 3722,
      MultipleHrefLangs: replacement
    }
  });
  assert.deepEqual(Object.keys(payload), ["seo"], "no debe enviar campos externos a SEO");
  assert.equal(Object.prototype.hasOwnProperty.call(payload, "slug"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, "title"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, "category"), false);
  assert.equal(source.seo.MetaImage.data.id, 3722, "la respuesta original no debe mutarse");
  assert.equal(source.seo.MultipleHrefLangs[0].url, "anterior", "solo cambia el payload nuevo");
});

test("cancela el PUT si una MetaImage existente no tiene identificador", () => {
  const source = {
    seo: {
      MetaTitle: "No debe perderse",
      MetaImage: { data: { attributes: { name: "sin-id.webp" } } },
      MultipleHrefLangs: []
    }
  };

  assert.throws(
    () => safeComponentUpdatePayload(source, "seo.MultipleHrefLangs", []),
    /MetaImage tiene una imagen sin id/
  );
});
