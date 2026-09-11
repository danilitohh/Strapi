import assert from "node:assert/strict";
import test from "node:test";
import { normalizeExistingHrefLangs } from "../src/automation.js";
import type { HrefLang } from "../src/types.js";

test("elimina entradas con hrefLang nulo y códigos duplicados", () => {
  const items = [
    { id: 1, hrefLang: null, url: "https://utel.edu.mx/programa", locale: "", rel: "alternate" },
    { id: 2, hrefLang: "es-mx", url: "https://utel.edu.mx/programa", locale: null, rel: "alternate" },
    { id: 3, hrefLang: "ES-MX", url: "https://utel.edu.mx/programa", locale: null, rel: "alternate" },
    { id: 4, hrefLang: "x-default", url: "https://utel.edu.mx/programa", locale: null, rel: "alternate" }
  ] as unknown as HrefLang[];

  assert.deepEqual(normalizeExistingHrefLangs(items).map(item => item.hrefLang), ["es-mx", "x-default"]);
});
