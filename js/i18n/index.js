/*
 * Translation lookup. Dictionaries are flat key -> string maps with identical
 * key sets (tests/i18n.test.js enforces it). Only applyTranslations touches
 * the DOM, and only through the root it is given.
 */
import en from "./en.js";
import es from "./es.js";
import pt from "./pt.js";

export const DICTIONARIES = Object.freeze({ es, pt, en });
export const LANGUAGES = Object.freeze(["es", "pt", "en"]);
export const DEFAULT_LANGUAGE = "es";

/** Intl locale per UI language. */
const LOCALES = Object.freeze({ es: "es-MX", pt: "pt-BR", en: "en-US" });
/** Value for <html lang>. */
const HTML_LANG = Object.freeze({ es: "es", pt: "pt-BR", en: "en" });
const STORAGE_KEY = "lir-web.language";

let current = DEFAULT_LANGUAGE;

export function getLanguage() {
  return current;
}

export function getLocale() {
  return LOCALES[current];
}

export function getHtmlLang() {
  return HTML_LANG[current];
}

export function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/** Switch language and remember it (localStorage, when available). */
export function setLanguage(language) {
  if (!isLanguage(language)) return current;
  current = language;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, language);
  } catch {
    // Storage can be blocked (private mode); the switch still works for this visit.
  }
  return current;
}

/** The stored language, or the default. */
export function storedLanguage() {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY);
    return isLanguage(value) ? value : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function hasKey(key) {
  return key in DICTIONARIES[DEFAULT_LANGUAGE];
}

/** Look up a key; `{name}` placeholders are filled from `vars`. Falls back to Spanish. */
export function t(key, vars) {
  const text = DICTIONARIES[current][key] ?? DICTIONARIES[DEFAULT_LANGUAGE][key] ?? key;
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
