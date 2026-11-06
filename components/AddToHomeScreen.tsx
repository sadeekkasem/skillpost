"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/LanguageProvider";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true
  );
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // Chrome/Firefox/Edge on iOS identify themselves; plain Safari does not.
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Firefox|Edg/.test(ua);
  return isIos && /Safari/.test(ua) && !isOtherBrowser;
}

export default function AddToHomeScreen() {
  const t = useT();
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<"hidden" | "install" | "ios">("hidden");
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setMode("hidden");
      return;
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      deferred.current = event as BeforeInstallPromptEvent;
      setMode("install");
      setShowTip(false);
    };

    const onInstalled = () => {
      deferred.current = null;
      setMode("hidden");
      setShowTip(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    if (isIosSafari()) setMode("ios");

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (mode === "hidden") return null;

  async function install() {
    const event = deferred.current;
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    deferred.current = null;
    if (outcome === "accepted") setMode("hidden");
  }

  return (
    <span className="add-home">
      {" · "}
      {mode === "install" ? (
        <button type="button" className="add-home-btn" onClick={install}>
          {t("footer.addToHome")}
        </button>
      ) : (
        <>
          <button
            type="button"
            className="add-home-btn"
            aria-expanded={showTip}
            onClick={() => setShowTip((value) => !value)}
          >
            {t("footer.addToHome")}
          </button>
          {showTip ? (
            <span className="add-home-tip" role="note">
              {t("footer.addToHomeIosTip")}
            </span>
          ) : null}
        </>
      )}
    </span>
  );
}
