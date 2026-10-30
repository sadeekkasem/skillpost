"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LANG_COOKIE,
  LANG_STORAGE_KEY,
  dirOf,
  isLang,
  translator,
  type Lang,
  type TFunction,
} from "@/lib/i18n";

type LanguageContextValue = {
  lang: Lang;
  /** True once the visitor has explicitly picked a language. */
  chosen: boolean;
  /** False until the client has checked for a saved choice. */
  ready: boolean;
  setLang: (lang: Lang) => void;
  t: TFunction;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function persist(lang: Lang) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {}
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LANG_COOKIE}=${lang}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

function applyToDocument(lang: Lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = dirOf(lang);
}

export default function LanguageProvider({
  initialLang,
  initialChosen,
  children,
}: {
  initialLang: Lang;
  initialChosen: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [chosen, setChosen] = useState(initialChosen);
  const [ready, setReady] = useState(initialChosen);

  const setLang = useCallback(
    (next: Lang) => {
      persist(next);
      applyToDocument(next);
      setLangState(next);
      setChosen(true);
      // Re-render server components (footer, metadata, not-found) in the new language.
      router.refresh();
    },
    [router]
  );

  useEffect(() => {
    if (initialChosen) return;
    // Cookie missing but localStorage remembers a choice (e.g. cookie cleared): restore it.
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(LANG_STORAGE_KEY);
    } catch {}
    if (isLang(stored)) setLang(stored);
    setReady(true);
  }, [initialChosen, setLang]);

  const value = useMemo(
    () => ({ lang, chosen, ready, setLang, t: translator(lang) }),
    [lang, chosen, ready, setLang]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}

export function useT(): TFunction {
  return useLanguage().t;
}
