import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const RELOAD_KEY = "chunk-reload-attempted";
const RELOAD_TS_KEY = "chunk-reload-timestamp";

function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message || "";
  const name = error.name || "";
  return (
    name === "ChunkLoadError" ||
    msg.includes("loading chunk") ||
    msg.includes("Loading chunk") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("dynamically imported module") ||
    (msg.includes("Failed to fetch") && msg.includes("module"))
  );
}

function hardReload() {
  sessionStorage.removeItem(RELOAD_KEY);
  sessionStorage.removeItem(RELOAD_TS_KEY);
  const url = new URL(window.location.href);
  url.searchParams.set("_cb", String(Date.now()));
  window.location.replace(url.toString());
}

async function bootstrap() {
  const root = createRoot(document.getElementById("root")!);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  // Success — clear reload flags
  sessionStorage.removeItem(RELOAD_KEY);
  sessionStorage.removeItem(RELOAD_TS_KEY);
}

bootstrap().catch((error) => {
  console.error("[Bootstrap] Failed to load app:", error);

  if (isChunkLoadError(error)) {
    const lastAttempt = sessionStorage.getItem(RELOAD_TS_KEY);
    const now = Date.now();
    const canRetry = !lastAttempt || now - Number(lastAttempt) > 30_000;

    if (canRetry) {
      console.log("[Bootstrap] Chunk load error — hard reloading...");
      sessionStorage.setItem(RELOAD_KEY, "1");
      sessionStorage.setItem(RELOAD_TS_KEY, String(now));
      hardReload();
      return;
    }
  }

  // Fallback error UI
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif;padding:2rem;text-align:center;">
        <h2 style="margin-bottom:0.5rem;">Error al cargar la aplicación</h2>
        <p style="color:#666;margin-bottom:1.5rem;">Se produjo un error inesperado. Hacé clic para cargar la última versión.</p>
        <button onclick="(function(){sessionStorage.removeItem('${RELOAD_KEY}');sessionStorage.removeItem('${RELOAD_TS_KEY}');var u=new URL(location.href);u.searchParams.set('_cb',Date.now());location.replace(u)})()" style="padding:0.75rem 1.5rem;background:#2563eb;color:white;border:none;border-radius:0.5rem;cursor:pointer;font-size:1rem;">
          Actualizar ahora
        </button>
      </div>
    `;
  }
});
