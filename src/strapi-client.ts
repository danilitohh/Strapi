import type { AppConfig } from "./config.js";
import type { JsonObject } from "./types.js";

interface StrapiListResponse {
  data: JsonObject[];
  meta?: { pagination?: { page?: number; pageCount?: number; total?: number } };
}

export class StrapiClient {
  constructor(private readonly config: AppConfig) {}

  private headers(): HeadersInit {
    return { Authorization: `Bearer ${this.config.token}`, "Content-Type": "application/json" };
  }

  private listUrl(page: number): string {
    const query = new URLSearchParams({
      "pagination[page]": String(page),
      "pagination[pageSize]": String(this.config.pageSize),
      "pagination[withCount]": "true",
      locale: this.config.locale,
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

  async getPage(page: number): Promise<StrapiListResponse> {
    return (await this.request(this.listUrl(page))).json() as Promise<StrapiListResponse>;
  }

  async *allProducts(): AsyncGenerator<JsonObject> {
    let page = 1;
    let pageCount = 1;
    do {
      const response = await this.getPage(page);
      if (!Array.isArray(response.data)) throw new Error("Strapi no devolvió un arreglo en data");
      for (const product of response.data) yield product;
      pageCount = response.meta?.pagination?.pageCount ?? (response.data.length === this.config.pageSize ? page + 1 : page);
      console.log(`Página ${page}/${pageCount}: ${response.data.length} productos`);
      page += 1;
    } while (page <= pageCount);
  }

  async updateProduct(identifier: string | number, data: JsonObject): Promise<void> {
    const locale = encodeURIComponent(this.config.locale);
    const url = `${this.config.baseUrl}${this.config.productsPath}/${encodeURIComponent(String(identifier))}?locale=${locale}`;
    await this.request(url, { method: "PUT", body: JSON.stringify({ data }) });
  }
}

