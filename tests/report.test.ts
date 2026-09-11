import assert from "node:assert/strict";
import test from "node:test";
import { buildReportRows } from "../src/report.js";
import type { SyncResult } from "../src/types.js";

test("incluye también productos sin cambios en el reporte", () => {
  const result: SyncResult = {
    identifier: 1,
    locale: "es-MX",
    slug: "bachillerato",
    productName: "Bachillerato en línea",
    siuKey: "TEST",
    hrefLangs: [
      { hrefLang: "x-default", url: "https://utel.edu.mx/bachillerato", locale: "", rel: "alternate" },
      { hrefLang: "es-mx", url: "https://utel.edu.mx/bachillerato", locale: "", rel: "alternate" }
    ],
    added: [],
    unavailable: [],
    action: "unchanged"
  };

  assert.deepEqual(buildReportRows([result]), [{
    Estado: "Sin cambios",
    "Nombre del producto": "Bachillerato en línea",
    siuKey: "TEST",
    País: "es-MX",
    Slug: "bachillerato",
    "Cantidad de HrefLang resultantes": 2,
    "Países incluidos": "Predeterminado, México",
    "Países no disponibles": "",
    Error: ""
  }]);
});
