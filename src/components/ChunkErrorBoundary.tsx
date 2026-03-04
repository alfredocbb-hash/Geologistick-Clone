import React from "react";

interface State {
  hasError: boolean;
}

const RELOAD_KEY = "chunk-reload-attempted";

export class ChunkErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    const isChunkError =
      error?.name === "ChunkLoadError" ||
      error?.message?.includes("Failed to fetch") ||
      error?.message?.includes("loading chunk") ||
      error?.message?.includes("Loading chunk") ||
      error?.message?.includes("Importing a module script failed") ||
      error?.message?.includes("dynamically imported module");

    if (isChunkError && !sessionStorage.getItem(RELOAD_KEY)) {
      console.log("[ChunkErrorBoundary] Chunk error — reloading...");
      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
          <h2>Error al cargar la página</h2>
          <p style={{ color: "#666", marginBottom: "1.5rem" }}>
            Se produjo un error al cargar los recursos. Por favor recargá la página.
          </p>
          <button
            onClick={() => {
              sessionStorage.removeItem(RELOAD_KEY);
              window.location.reload();
            }}
            style={{ padding: "0.75rem 1.5rem", background: "#2563eb", color: "white", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontSize: "1rem" }}
          >
            Recargar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
