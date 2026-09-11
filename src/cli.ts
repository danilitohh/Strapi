import { mkdir } from "node:fs/promises";
import ExcelJS from "exceljs";
import { loadConfig } from "./config.js";
import { processProduct } from "./automation.js";
import { getAtPath } from "./object-path.js";
import { StrapiClient } from "./strapi-client.js";
import type { ProductResult } from "./types.js";

const command = process.argv[2] ?? "run";
const apply = process.argv.includes("--apply");

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new StrapiClient(config);

  if (command === "inspect") {
    const firstPage = await client.getPage(1);
    const product = firstPage.data[0];
    const attributes = product?.attributes && typeof product.attributes === "object"
      ? product.attributes as Record<string, unknown>
      : product;
    const hrefLangs = getAtPath(attributes, config.hrefLangsPath);
    console.dir({
      meta: firstPage.meta,
      product: {
        id: product?.id,
        documentId: product?.documentId,
        slug: getAtPath(attributes, config.slugPath),
        hrefLangsPath: config.hrefLangsPath,
        hrefLangCount: Array.isArray(hrefLangs) ? hrefLangs.length : null,
        hrefLangSample: Array.isArray(hrefLangs) ? hrefLangs.slice(0, 2) : hrefLangs
      }
    }, { depth: 8, colors: true });
    console.log("\nInspección terminada. No se realizaron cambios.");
    return;
  }

  if (command !== "run") throw new Error(`Comando desconocido: ${command}`);
  console.log(apply ? "MODO APLICAR: se escribirán cambios en Strapi." : "MODO SIMULACIÓN: no se escribirá nada en Strapi.");
  if (config.maxProducts) console.log(`LÍMITE ACTIVO: se procesarán como máximo ${config.maxProducts} productos.`);

  const results: ProductResult[] = [];
  for await (const product of client.allProducts()) {
    if (config.maxProducts !== null && results.length >= config.maxProducts) break;
    try {
      const result = await processProduct(client, config, product, apply);
      results.push(result);
      console.log(`[${result.action}] ${result.slug}: +${result.added.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ identifier: "desconocido", slug: "desconocido", existingCount: 0, added: [], unavailable: [], action: "error", error: message });
      console.error(`[error] ${message}`);
    }
  }

  await mkdir("reports", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = `reports/${apply ? "apply" : "dry-run"}-${stamp}.xlsx`;
  const countryNames: Record<string, string> = {
    "x-default": "Predeterminado",
    "es-mx": "México",
    "es-co": "Colombia",
    "es-pe": "Perú",
    "es-ec": "Ecuador",
    "es-us": "Estados Unidos",
    "es-ar": "Argentina",
    "es-do": "República Dominicana",
    "es-gt": "Guatemala",
    "es-cl": "Chile",
    "es-sv": "El Salvador",
    "es-bo": "Bolivia",
    "es-pa": "Panamá",
    "es-py": "Paraguay"
  };
  const countryList = (codes: string[]) => codes.map(code => countryNames[code] ?? code).join(", ");
  const changedRows = results
    .filter(result => result.action === "updated" || result.action === "would-update")
    .map(result => ({
      "Nombre del producto": result.productName ?? result.slug,
      siuKey: result.siuKey ?? "",
      País: config.locale,
      "Cantidad de hreflang agregados": result.added.length,
      "Países agregados": countryList(result.added.map(item => item.hreflang)),
      "Países no disponibles": countryList(result.unavailable.map(item => item.hreflang))
    }));
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Productos modificados");
  worksheet.columns = [
    { header: "Nombre del producto", key: "Nombre del producto", width: 58 },
    { header: "siuKey", key: "siuKey", width: 16 },
    { header: "País", key: "País", width: 14 },
    { header: "Cantidad de hreflang agregados", key: "Cantidad de hreflang agregados", width: 28 },
    { header: "Países agregados", key: "Países agregados", width: 58 },
    { header: "Países no disponibles", key: "Países no disponibles", width: 58 }
  ];
  changedRows.forEach(row => worksheet.addRow(row));
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
  worksheet.eachRow(row => {
    row.alignment = { vertical: "middle", wrapText: true };
  });
  await workbook.xlsx.writeFile(reportPath);
  const counts = results.reduce<Record<string, number>>((acc, result) => {
    acc[result.action] = (acc[result.action] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`\nReporte: ${reportPath}`);
  console.log(counts);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
