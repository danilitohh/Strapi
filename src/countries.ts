import type { CountryTarget, HrefLang } from "./types.js";

export const MAX_HREFLANGS = 14;

const LICENCIATURA_TO_CARRERA = { from: /^licenciatura(?=-|$)/, to: "carrera" };
const MAESTRIA_TO_MAGISTER = { from: /^maestria(?=-|$)/, to: "magister" };

export const TARGETS: CountryTarget[] = [
  { hreflang: "x-default", baseUrl: "https://utel.edu.mx", countryPath: null },
  { hreflang: "es-mx", baseUrl: "https://utel.edu.mx", countryPath: null },
  { hreflang: "es-co", baseUrl: "https://utel.edu.mx", countryPath: "colombia", slugRules: [LICENCIATURA_TO_CARRERA] },
  { hreflang: "es-pe", baseUrl: "https://utlenlinea.com", countryPath: null, slugRules: [LICENCIATURA_TO_CARRERA] },
  { hreflang: "es-ec", baseUrl: "https://utel.edu.mx", countryPath: "ecuador", slugRules: [LICENCIATURA_TO_CARRERA] },
  { hreflang: "es-us", baseUrl: "https://utel.edu.mx", countryPath: "usa" },
  { hreflang: "es-ar", baseUrl: "https://utel.edu.mx", countryPath: "argentina" },
  { hreflang: "es-do", baseUrl: "https://utel.edu.mx", countryPath: "dominicana" },
  { hreflang: "es-gt", baseUrl: "https://utel.edu.mx", countryPath: "guatemala" },
  { hreflang: "es-cl", baseUrl: "https://utel.edu.mx", countryPath: "chile", slugRules: [LICENCIATURA_TO_CARRERA, MAESTRIA_TO_MAGISTER] },
  { hreflang: "es-sv", baseUrl: "https://utel.edu.mx", countryPath: "elsalvador" },
  { hreflang: "es-bo", baseUrl: "https://utel.edu.mx", countryPath: "bolivia", slugRules: [LICENCIATURA_TO_CARRERA] },
  { hreflang: "es-pa", baseUrl: "https://utel.edu.mx", countryPath: "panama" },
  { hreflang: "es-py", baseUrl: "https://utel.edu.mx", countryPath: "paraguay", slugRules: [LICENCIATURA_TO_CARRERA] }
];

export function buildUrl(target: CountryTarget, slug: string): string {
  const countrySlug = (target.slugRules ?? []).reduce(
    (current, rule) => current.replace(rule.from, rule.to),
    slug
  );
  const segments = [target.baseUrl.replace(/\/$/, ""), target.countryPath, countrySlug]
    .filter(Boolean)
    .map((segment, index) => (index === 0 ? segment : encodeURIComponent(String(segment))));
  return segments.join("/");
}

export function createHrefLang(hreflang: string, url: string): HrefLang {
  return { hreflang, url, locale: "", rel: "alternate" };
}
