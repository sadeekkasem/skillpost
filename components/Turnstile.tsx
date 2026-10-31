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
  execute: (id?: string) => void;
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

export type TurnstileHandle = {
  /** Runs the check now and resolves with a fresh single-use token. */
  getToken: () => Promise<string>;
  /** Clears the used token so the next getToken() runs a new check. */
  reset: () => void;
};

type Props = { language?: string };

type Pending = { resolve: (t: string) => void; reject: (e: Error) => void };

/**
 * Cloudflare Turnstile in execute mode: nothing runs on page load. The check
 * runs when the user submits; Cloudflare only shows its checkbox if it needs
 * interaction.
 */
const Turnstile = forwardRef<TurnstileHandle, Props>(function Turnstile(
  { language },
  ref
) {
  const box = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const pending = useRef<Pending | null>(null);
  const lang = useRef(language);

  useImperativeHandle(ref, () => ({
    async getToken() {
      const ts = await loadTurnstile();
      for (let i = 0; i < 50 && !widgetId.current; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
      const id = widgetId.current;
      if (!id) throw new Error("captcha unavailable");
      pending.current?.reject(new Error("captcha superseded"));
      return new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.current = null;
          ts.reset(id);
          reject(new Error("captcha timeout"));
        }, 120_000);
        pending.current = {
          resolve: (t) => { clearTimeout(timer); resolve(t); },
          reject: (e) => { clearTimeout(timer); reject(e); },
        };
        ts.execute(id);
      });
    },
    reset() {
      if (window.turnstile && widgetId.current) window.turnstile.reset(widgetId.current);
    },
  }), []);

  useEffect(() => {
    let cancelled = false;
    const settle = (fn: (p: Pending) => void) => {
      const p = pending.current;
      pending.current = null;
      if (p) fn(p);
    };
    loadTurnstile()
      .then((ts) => {
        if (cancelled || !box.current || widgetId.current) return;
        widgetId.current = ts.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          language: lang.current || "auto",
          execution: "execute",
          appearance: "interaction-only",
          callback: (token: string) => settle((p) => p.resolve(token)),
          "error-callback": () => {
            settle((p) => p.reject(new Error("captcha failed")));
            return true;
          },
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      settle((p) => p.reject(new Error("captcha unmounted")));
      if (window.turnstile && widgetId.current) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, []);

  return <div ref={box} className="turnstile-box" />;
});

export default Turnstile;
