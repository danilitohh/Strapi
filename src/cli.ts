import { mkdir, writeFile } from "node:fs/promises";
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

  const results: ProductResult[] = [];
  for await (const product of client.allProducts()) {
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
  const reportPath = `reports/${apply ? "apply" : "dry-run"}-${stamp}.json`;
  await writeFile(reportPath, JSON.stringify({ mode: apply ? "apply" : "dry-run", results }, null, 2), "utf8");
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
