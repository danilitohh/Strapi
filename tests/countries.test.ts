import assert from "node:assert/strict";
import test from "node:test";
import { buildUrl, TARGETS } from "../src/countries.js";

const slug = "licenciatura-en-gestion-de-politicas-y-gobierno";

test("construye México sin segmento de país", () => {
  const mexico = TARGETS.find(target => target.hreflang === "es-mx")!;
  assert.equal(buildUrl(mexico, slug), `https://utel.edu.mx/${slug}`);
});

test("construye USA con segmento de país", () => {
  const usa = TARGETS.find(target => target.hreflang === "es-us")!;
  assert.equal(buildUrl(usa, slug), `https://utel.edu.mx/usa/${slug}`);
});

test("construye Perú con su dominio independiente", () => {
  const peru = TARGETS.find(target => target.hreflang === "es-pe")!;
  assert.equal(buildUrl(peru, slug), `https://utlenlinea.com/${slug}`);
});

test("incluye 13 países y x-default", () => {
  assert.equal(TARGETS.length, 14);
  assert.equal(new Set(TARGETS.map(target => target.hreflang)).size, 14);
});

