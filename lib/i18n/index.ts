import { ar, type Dict, type DictKey } from "./ar";
import { en } from "./en";

export type Lang = "ar" | "en";
export type { Dict, DictKey };
export const DEFAULT_LANG: Lang = "ar";
export const LANG_COOKIE = "lang";
export const LANG_STORAGE_KEY = "skillpost_lang";

const dictionaries: Record<Lang, Dict> = { ar, en };

export function isLang(value: unknown): value is Lang {
  return value === "ar" || value === "en";
}

export function dirOf(lang: Lang): "rtl" | "ltr" {
  return lang === "ar" ? "rtl" : "ltr";
}

export type TFunction = (key: DictKey, vars?: Record<string, string | number>) => string;

export function translator(lang: Lang): TFunction {
  const dict = dictionaries[lang];
  return (key, vars) => {
    const text = dict[key] ?? ar[key];
    if (!vars) return text;
    return text.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
  };
}
