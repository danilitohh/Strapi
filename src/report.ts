import { mkdir } from "node:fs/promises";
import ExcelJS from "exceljs";
import type { SyncResult } from "./types.js";

const COUNTRY_NAMES: Record<string, string> = {
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

const STATUS_NAMES: Record<SyncResult["action"], string> = {
  updated: "Actualizado",
  "would-update": "Se actualizaría",
  unchanged: "Sin cambios",
  error: "Error"
};

function countryList(codes: string[]): string {
  return codes.map(code => COUNTRY_NAMES[code] ?? code).join(", ");
}

export function buildReportRows(results: SyncResult[]) {
  return results.map(result => ({
    Estado: STATUS_NAMES[result.action],
    "Nombre del producto": result.productName || result.slug,
    siuKey: result.siuKey,
    País: result.locale,
    Slug: result.slug,
    "Cantidad de HrefLang resultantes": result.hrefLangs.length,
    "Países incluidos": countryList(result.hrefLangs.map(item => item.hrefLang)),
    "Países no disponibles": countryList(result.unavailable.map(item => item.hreflang)),
    Error: result.error ?? ""
  }));
}

export async function writeExcelReport(results: SyncResult[], apply: boolean): Promise<string> {
  await mkdir("reports", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = `reports/${apply ? "apply" : "dry-run"}-${stamp}.xlsx`;
  const rows = buildReportRows(results);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Resultados", { views: [{ state: "frozen", ySplit: 1 }] });
  worksheet.columns = [
    { header: "Estado", key: "Estado", width: 18 },
    { header: "Nombre del producto", key: "Nombre del producto", width: 52 },
    { header: "siuKey", key: "siuKey", width: 18 },
    { header: "País", key: "País", width: 14 },
    { header: "Slug", key: "Slug", width: 58 },
    { header: "Cantidad de HrefLang resultantes", key: "Cantidad de HrefLang resultantes", width: 34 },
    { header: "Países incluidos", key: "Países incluidos", width: 58 },
    { header: "Países no disponibles", key: "Países no disponibles", width: 58 },
    { header: "Error", key: "Error", width: 50 }
  ];
  rows.forEach(row => worksheet.addRow(row));

  const header = worksheet.getRow(1);
  header.height = 26;
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
  header.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  worksheet.autoFilter = { from: "A1", to: "I1" };

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.alignment = { vertical: "middle", wrapText: true };
    const status = String(row.getCell(1).value ?? "");
    const color = status === "Error" ? "FFFCE8E6"
      : status === "Actualizado" ? "FFE6F4EA"
      : status === "Se actualizaría" ? "FFFFF4CE"
      : "FFF3F4F6";
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
    row.getCell(1).font = { bold: true };
  });

  await workbook.xlsx.writeFile(reportPath);
  return reportPath;
}
