import "dotenv/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta la variable ${name} en el archivo .env`);
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} debe ser un entero positivo`);
  return value;
}

function optionalPositiveInteger(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} debe ser un entero positivo`);
  return value;
}

export function loadConfig() {
  return {
    token: required("STRAPI_API_TOKEN"),
    baseUrl: (process.env.STRAPI_BASE_URL ?? "https://api-cms.utel.edu.mx").replace(/\/$/, ""),
    productsPath: process.env.STRAPI_PRODUCTS_PATH ?? "/api/products",
    locale: process.env.STRAPI_LOCALE ?? "es-MX",
    pageSize: positiveInteger("STRAPI_PAGE_SIZE", 100),
    maxProducts: optionalPositiveInteger("MAX_PRODUCTS"),
    slugPath: process.env.STRAPI_SLUG_PATH ?? "slug",
    hrefLangsPath: process.env.STRAPI_HREFLANGS_PATH ?? "seo.MultipleHrefLangs",
    populateQuery: process.env.STRAPI_POPULATE_QUERY ?? "populate[seo][populate]=*",
    timeoutMs: positiveInteger("HTTP_TIMEOUT_MS", 12000),
    concurrency: positiveInteger("HTTP_CONCURRENCY", 8)
  };
}

export type AppConfig = ReturnType<typeof loadConfig>;
