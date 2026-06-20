"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    const serviceWorkerEnabled =
      process.env.NODE_ENV === "production" ||
      process.env.NEXT_PUBLIC_ENABLE_SERVICE_WORKER === "true";

    if (!serviceWorkerEnabled || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error) => {
        console.error("Service worker registration failed:", error);
      });

    if (window.location.pathname === "/login") {
      navigator.serviceWorker.ready.then((registration) => {
        registration.active?.postMessage({ type: "clear-auth-cache" });
      });
    }
  }, []);

  return null;
}
