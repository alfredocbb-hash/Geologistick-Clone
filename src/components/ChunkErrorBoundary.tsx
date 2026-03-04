import React from "react";

interface State {
  hasError: boolean;
  isChunkError: boolean;
}

const RELOAD_KEY = "chunk-reload-attempted";
const RELOAD_TS_KEY = "chunk-reload-timestamp";

function isChunkLoadError(error: Error): boolean {
  const msg = error?.message || "";
  const name = error?.name || "";
  return (
    name === "ChunkLoadError" ||
    msg.includes("loading chunk") ||
    msg.includes("Loading chunk") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("dynamically imported module") ||
    // Only match "Failed to fetch" when it looks like a module/script load
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

export class ChunkErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      isChunkError: isChunkLoadError(error),
    };
  }

  componentDidCatch(error: Error) {
    if (!isChunkLoadError(error)) {
      console.error("[ChunkErrorBoundary] Non-chunk error caught:", error);
      return;
    }

    const lastAttempt = sessionStorage.getItem(RELOAD_TS_KEY);
    const now = Date.now();
    // Allow retry if last attempt was >30s ago
    const canRetry = !lastAttempt || now - Number(lastAttempt) > 30_000;

    if (canRetry) {
      console.log("[ChunkErrorBoundary] Chunk error — hard reloading...");
      sessionStorage.setItem(RELOAD_KEY, "1");
      sessionStorage.setItem(RELOAD_TS_KEY, String(now));
      hardReload();
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, isChunkError: false });
  };

  render() {
    if (this.state.hasError) {
      if (this.state.isChunkError) {
        return (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
            <h2>Nueva versión disponible</h2>
            <p style={{ color: "#666", marginBottom: "1.5rem" }}>
              Hay una actualización. Hacé clic para cargar la última versión.
            </p>
            <button
              onClick={hardReload}
              style={{ padding: "0.75rem 1.5rem", background: "#2563eb", color: "white", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontSize: "1rem" }}
            >
              Actualizar ahora
            </button>
          </div>
        );
      }

      // Generic runtime error — allow retry without full reload
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
          <h2>Algo salió mal</h2>
          <p style={{ color: "#666", marginBottom: "1.5rem" }}>
            Se produjo un error inesperado. Podés intentar de nuevo.
          </p>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={this.handleRetry}
              style={{ padding: "0.75rem 1.5rem", background: "#2563eb", color: "white", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontSize: "1rem" }}
            >
              Reintentar
            </button>
            <button
              onClick={hardReload}
              style={{ padding: "0.75rem 1.5rem", background: "transparent", color: "#2563eb", border: "1px solid #2563eb", borderRadius: "0.5rem", cursor: "pointer", fontSize: "1rem" }}
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
