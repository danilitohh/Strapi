export type JsonObject = Record<string, unknown>;

export interface HrefLang extends JsonObject {
  hrefLang: string;
  url: string;
  locale: string;
  rel: "alternate";
}

export interface CountryTarget {
  hreflang: string;
  countryPath: string | null;
  baseUrl: string;
  slugRules?: Array<{ from: RegExp; to: string }>;
}

export interface ProductResult {
  identifier: string | number;
  slug: string;
  productName?: string;
  siuKey?: string;
  existingCount: number;
  removedInvalidCount?: number;
  added: HrefLang[];
  unavailable: Array<{ hreflang: string; url: string }>;
  action: "skipped-complete" | "unchanged" | "would-update" | "updated" | "error";
  error?: string;
}

export interface SyncResult {
  identifier: string | number;
  locale: string;
  slug: string;
  productName: string;
  siuKey: string;
  hrefLangs: HrefLang[];
  added: HrefLang[];
  unavailable: Array<{ hreflang: string; reason: string }>;
  action: "updated" | "would-update" | "unchanged" | "error";
  error?: string;
}
