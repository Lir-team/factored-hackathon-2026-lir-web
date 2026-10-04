/* Translation lookup. Dictionaries are flat key -> string maps. */
import es from "./es.js";

const dictionaries = { es };
const LOCALES = { es: "es-MX", pt: "pt-BR", en: "en-US" };

let current = "es";

export function getLanguage() {
  return current;
}

export function getLocale() {
  return LOCALES[current];
}

/** Look up a key; `{name}` placeholders are filled from `vars`. Falls back to Spanish. */
export function t(key, vars) {
  const text = dictionaries[current]?.[key] ?? dictionaries.es[key] ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

/** Fill every [data-i18n] element under `root` with its translation. */
export function applyTranslations(root) {
  for (const el of root.querySelectorAll("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of root.querySelectorAll("[data-i18n-aria-label]")) {
    el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel));
  }
}
