import React from 'react';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logError } from '@/lib/errorLogger';

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Boundary local del flujo "Crear envío". Captura cualquier excepción en render
 * de NewShipment (o sus hijos), la persiste en `system_error_logs` y muestra
 * un fallback contextual con el mensaje real — en vez de caer al ChunkErrorBoundary
 * global anónimo "Algo salió mal".
 */
export class NewShipmentBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[NewShipmentBoundary] Error capturado:', error, info);
    // Best-effort persist for post-mortem (no await — fire and forget)
    logError(error, 'NewShipment', {
      componentStack: info.componentStack ?? null,
    }).catch(() => {});
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleBack = () => {
    window.history.length > 1 ? window.history.back() : (window.location.href = '/shipments');
  };

  render() {
    if (this.state.hasError) {
      const message = this.state.error?.message || 'Error inesperado al preparar el envío';
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <div className="max-w-md w-full border border-destructive/30 bg-destructive/5 rounded-xl p-6 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-destructive/15 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Hubo un error al preparar el envío</h2>
              <p className="text-sm text-muted-foreground">
                El error fue registrado automáticamente. Podés reintentar o volver al listado.
              </p>
            </div>
            <pre className="text-xs text-left bg-background border rounded-md p-2 overflow-auto max-h-32 whitespace-pre-wrap break-words">
              {message}
            </pre>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={this.handleBack}>
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Volver
              </Button>
              <Button size="sm" onClick={this.handleRetry}>
                <RefreshCw className="h-4 w-4 mr-1.5" /> Reintentar
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default NewShipmentBoundary;
