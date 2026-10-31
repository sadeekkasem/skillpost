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
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorReset = useRef(false);
  cb.current = onToken;

  useImperativeHandle(ref, () => ({
    reset() {
      cb.current("");
      errorReset.current = false;
      if (window.turnstile && widgetId.current) window.turnstile.reset(widgetId.current);
    },
  }));

  useEffect(() => {
    let cancelled = false;
    // Clear the token and run one fresh challenge shortly after, so the
    // widget never stays stuck in a failed/expired state.
    const recover = () => {
      cb.current("");
      if (errorReset.current) return;
      errorReset.current = true;
      setTimeout(() => {
        errorReset.current = false;
        if (!cancelled && widgetId.current) window.turnstile?.reset(widgetId.current);
      }, 1500);
    };
    loadTurnstile()
      .then((ts) => {
        if (cancelled || !box.current || widgetId.current) return;
        widgetId.current = ts.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          language: language || "auto",
          // We own recovery (recover() + 4-min pre-emptive reset); "manual"
          // stops Cloudflare's own auto-refresh from racing our reset.
          "refresh-expired": "manual",
          "refresh-timeout": "manual",
          callback: (token: string) => {
            errorReset.current = false;
            cb.current(token);
            // Tokens live ~300s. Swap in a fresh one before expiry so an idle
            // form never hits Cloudflare's expiry/refresh path.
            if (refreshTimer.current) clearTimeout(refreshTimer.current);
            refreshTimer.current = setTimeout(() => {
              cb.current("");
              if (widgetId.current) window.turnstile?.reset(widgetId.current);
            }, 240_000);
          },
          "expired-callback": recover,
          "timeout-callback": recover,
          "error-callback": () => {
            recover();
            return true;
          },
        });
      })
      .catch(() => cb.current(""));
    return () => {
      cancelled = true;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (window.turnstile && widgetId.current) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [language]);

  return <div ref={box} className="turnstile-box" style={{ minHeight: 65 }} />;
});

export default Turnstile;
