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
  assert.equal(buildUrl(peru, slug), "https://utlenlinea.com/carrera-en-gestion-de-politicas-y-gobierno");
});

test("convierte licenciatura en carrera solo para los países indicados", () => {
  for (const code of ["es-cl", "es-bo", "es-co", "es-ec", "es-py"]) {
    const target = TARGETS.find(item => item.hreflang === code)!;
    assert.match(buildUrl(target, slug), /\/carrera-en-gestion-de-politicas-y-gobierno$/);
  }
  for (const code of ["es-mx", "es-us", "es-ar", "es-do", "es-gt", "es-sv", "es-pa"]) {
    const target = TARGETS.find(item => item.hreflang === code)!;
    assert.match(buildUrl(target, slug), /\/licenciatura-en-gestion-de-politicas-y-gobierno$/);
  }
});

test("convierte maestría en magíster únicamente para Chile", () => {
  const chile = TARGETS.find(target => target.hreflang === "es-cl")!;
  const mexico = TARGETS.find(target => target.hreflang === "es-mx")!;
  assert.equal(buildUrl(chile, "maestria-en-finanzas"), "https://utel.edu.mx/chile/magister-en-finanzas");
  assert.equal(buildUrl(mexico, "maestria-en-finanzas"), "https://utel.edu.mx/maestria-en-finanzas");
});

test("incluye 13 países y x-default", () => {
  assert.equal(TARGETS.length, 14);
  assert.equal(new Set(TARGETS.map(target => target.hreflang)).size, 14);
});
