import type { AppConfig } from "./config.js";
import { safeComponentUpdatePayload } from "./object-path.js";
import type { JsonObject } from "./types.js";

interface StrapiListResponse {
  data: JsonObject[];
  meta?: { pagination?: { page?: number; pageCount?: number; total?: number } };
}

interface StrapiItemResponse {
  data: JsonObject;
}

function attributesOf(product: JsonObject): JsonObject {
  const attributes = product.attributes;
  return attributes && typeof attributes === "object" && !Array.isArray(attributes)
    ? attributes as JsonObject
    : product;
}

export class StrapiClient {
  constructor(private readonly config: AppConfig) {}

  private headers(): HeadersInit {
    return { Authorization: `Bearer ${this.config.token}`, "Content-Type": "application/json" };
  }

  private listUrl(locale: string, page: number): string {
    const query = new URLSearchParams({
      "pagination[page]": String(page),
      "pagination[pageSize]": String(this.config.pageSize),
      "pagination[withCount]": "true",
      locale,
      sort: "slug:asc"
    });
    const populate = this.config.populateQuery.replace(/^\?/, "");
    return `${this.config.baseUrl}${this.config.productsPath}?${query.toString()}${populate ? `&${populate}` : ""}`;
  }

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetch(url, { ...init, headers: { ...this.headers(), ...init.headers } });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 1000);
      throw new Error(`Strapi respondió ${response.status} ${response.statusText}: ${body}`);
    }
    return response;
  }

  async getPage(page: number, locale = this.config.locale): Promise<StrapiListResponse> {
    return (await this.request(this.listUrl(locale, page))).json() as Promise<StrapiListResponse>;
  }

  async *allProducts(locale = this.config.locale): AsyncGenerator<JsonObject> {
    let page = 1;
    let pageCount = 1;
    do {
      const response = await this.getPage(page, locale);
      if (!Array.isArray(response.data)) throw new Error("Strapi no devolvió un arreglo en data");
      for (const product of response.data) yield product;
      pageCount = response.meta?.pagination?.pageCount ?? (response.data.length === this.config.pageSize ? page + 1 : page);
      console.log(`Página ${page}/${pageCount}: ${response.data.length} productos`);
      page += 1;
    } while (page <= pageCount);
  }

  private itemUrl(identifier: string | number, locale: string, populate: boolean): string {
    const encodedLocale = encodeURIComponent(locale);
    const base = `${this.config.baseUrl}${this.config.productsPath}/${encodeURIComponent(String(identifier))}?locale=${encodedLocale}`;
    const populateQuery = this.config.populateQuery.replace(/^\?/, "");
    return populate && populateQuery ? `${base}&${populateQuery}` : base;
  }

  async updateProductHrefLangs(
    identifier: string | number,
    locale: string,
    hrefLangsPath: string,
    hrefLangs: unknown
  ): Promise<void> {
    const current = await this.request(this.itemUrl(identifier, locale, true));
    const response = await current.json() as StrapiItemResponse;
    if (!response.data || typeof response.data !== "object") {
      throw new Error(`Actualización cancelada: Strapi no devolvió el producto ${identifier}`);
    }

    const data = safeComponentUpdatePayload(attributesOf(response.data), hrefLangsPath, hrefLangs);
    const url = this.itemUrl(identifier, locale, false);
    await this.request(url, { method: "PUT", body: JSON.stringify({ data }) });
  }
}

