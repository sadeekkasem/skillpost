import { cookies } from "next/headers";
import { DEFAULT_LANG, LANG_COOKIE, isLang, translator, type Lang } from "./index";

export async function getLang(): Promise<{ lang: Lang; chosen: boolean }> {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(value) ? { lang: value, chosen: true } : { lang: DEFAULT_LANG, chosen: false };
}

export async function getT() {
  return translator((await getLang()).lang);
}
