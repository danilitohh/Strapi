import { loadConfig } from "./config.js";
import { synchronizeProducts } from "./sync.js";
import { getAtPath } from "./object-path.js";
import { writeExcelReport } from "./report.js";
import { StrapiClient } from "./strapi-client.js";

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

  const results = await synchronizeProducts(client, config, apply);
  for (const result of results) {
    console.log(`[${result.action}] ${result.locale}/${result.slug}: ${result.added.length} hreflang`);
  }

  const reportPath = await writeExcelReport(results, apply);
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
