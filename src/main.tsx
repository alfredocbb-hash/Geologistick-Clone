import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const RELOAD_KEY = "chunk-reload-attempted";

async function bootstrap() {
  const root = createRoot(document.getElementById("root")!);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  // If we got here successfully, clear the reload flag
  sessionStorage.removeItem(RELOAD_KEY);
}

bootstrap().catch((error) => {
  console.error("[Bootstrap] Failed to load app:", error);

  const isChunkError =
    error?.name === "ChunkLoadError" ||
    error?.message?.includes("Failed to fetch") ||
    error?.message?.includes("loading chunk") ||
    error?.message?.includes("Loading chunk") ||
    error?.message?.includes("Importing a module script failed") ||
    error?.message?.includes("dynamically imported module");

  const alreadyReloaded = sessionStorage.getItem(RELOAD_KEY);

  if (isChunkError && !alreadyReloaded) {
    console.log("[Bootstrap] Chunk load error detected — reloading page...");
    sessionStorage.setItem(RELOAD_KEY, "1");
    window.location.reload();
    return;
  }

  // Fallback: show a minimal error UI
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif;padding:2rem;text-align:center;">
        <h2 style="margin-bottom:0.5rem;">Error al cargar la aplicación</h2>
        <p style="color:#666;margin-bottom:1.5rem;">Se produjo un error inesperado. Por favor recargá la página.</p>
        <button onclick="sessionStorage.removeItem('${RELOAD_KEY}');window.location.reload()" style="padding:0.75rem 1.5rem;background:#2563eb;color:white;border:none;border-radius:0.5rem;cursor:pointer;font-size:1rem;">
          Recargar página
        </button>
      </div>
    `;
  }
});
