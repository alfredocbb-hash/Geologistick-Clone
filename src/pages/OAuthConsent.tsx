import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ShieldCheck, XCircle } from "lucide-react";

type AuthDetails = {
  client?: { name?: string; client_uri?: string; logo_uri?: string };
  redirect_uri?: string;
  scope?: string;
  redirect_url?: string;
  redirect_to?: string;
};

// Local typed wrapper for the beta supabase.auth.oauth namespace.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: AuthDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: AuthDetails | null; error: { message: string } | null }>;
};
const oauth = (): OAuthApi => (supabase.auth as any).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Falta el parámetro authorization_id");
        setLoading(false);
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const api = oauth();
    const { data, error } = approve
      ? await api.approveAuthorization(authorizationId)
      : await api.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("El servidor de autorización no devolvió redirect");
      return;
    }
    window.location.href = target;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" /> No se pudo cargar la autorización
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const clientName = details?.client?.name ?? "una aplicación";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Conectar {clientName} a Geologistick
          </CardTitle>
          <CardDescription>
            {clientName} podrá usar las herramientas habilitadas de Geologistick actuando como vos.
            Se respetan los permisos de tu tenant y las políticas de acceso de la app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {details?.scope && (
            <p className="text-sm text-muted-foreground">
              Permisos solicitados: <span className="font-mono">{details.scope}</span>
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aprobar"}
            </Button>
            <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
