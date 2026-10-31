"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

const FALLBACK_SITE_KEY = "0x4AAAAAAFtZYyeKb2sEGcFW";
export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || FALLBACK_SITE_KEY;

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile"));
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("turnstile"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export type TurnstileHandle = { reset: () => void };

type Props = {
  onToken: (token: string) => void;
  language?: string;
};

/** Cloudflare Turnstile widget; calls onToken("") when the token expires or errors. */
const Turnstile = forwardRef<TurnstileHandle, Props>(function Turnstile(
  { onToken, language },
  ref
) {
  const box = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useImperativeHandle(ref, () => ({
    reset() {
      cb.current("");
      if (window.turnstile && widgetId.current) window.turnstile.reset(widgetId.current);
    },
  }));

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then((ts) => {
        if (cancelled || !box.current) return;
        widgetId.current = ts.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          language: language || "auto",
          "refresh-expired": "auto",
          "refresh-timeout": "auto",
          retry: "auto",
          callback: (token: string) => cb.current(token),
          // Token expired (~300s): clear it and fetch a fresh one right away.
          "expired-callback": () => {
            cb.current("");
            if (widgetId.current) window.turnstile?.reset(widgetId.current);
          },
          "timeout-callback": () => {
            cb.current("");
            if (widgetId.current) window.turnstile?.reset(widgetId.current);
          },
          // Returning true tells Turnstile we handled it; its own retry continues.
          "error-callback": () => {
            cb.current("");
            return true;
          },
        });
      })
      .catch(() => cb.current(""));
    return () => {
      cancelled = true;
      if (window.turnstile && widgetId.current) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [language]);

  return <div ref={box} className="turnstile-box" style={{ minHeight: 65 }} />;
});

export default Turnstile;
