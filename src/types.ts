export type JsonObject = Record<string, unknown>;

export interface HrefLang extends JsonObject {
  hreflang: string;
  url: string;
  locale: string;
  rel: "alternate";
}

export interface CountryTarget {
  hreflang: string;
  countryPath: string | null;
  baseUrl: string;
}

export interface ProductResult {
  identifier: string | number;
  slug: string;
  existingCount: number;
  added: HrefLang[];
  unavailable: Array<{ hreflang: string; url: string }>;
  action: "skipped-complete" | "unchanged" | "would-update" | "updated" | "error";
  error?: string;
}

