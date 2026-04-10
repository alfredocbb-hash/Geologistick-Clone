import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface TenantBranding {
  nombre_app: string | null;
  logo_light: string | null;
  logo_dark: string | null;
  color_primario: string | null;
}

const TiendanubeOAuthResult = () => {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status");
  const sellerId = searchParams.get("seller_id");
  const tenantId = searchParams.get("tenant_id");
  const errorTitle = searchParams.get("title") || "Error";
  const errorMessage = searchParams.get("message") || "Ocurrió un error inesperado.";
  const [branding, setBranding] = useState<TenantBranding | null>(null);

  const isSuccess = status === "success";

  useEffect(() => {
    if (tenantId) {
      supabase
        .from("tenant_branding")
        .select("nombre_app, logo_light, logo_dark, color_primario")
        .eq("tenant_id", tenantId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setBranding(data);
        });
    }
  }, [tenantId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (window.opener) {
        window.opener.postMessage(
          isSuccess
            ? { type: "tiendanube-oauth-success", sellerId }
            : { type: "tiendanube-oauth-error" },
          "*"
        );
      }
      window.close();
    }, 5000);
    return () => clearTimeout(timer);
  }, [isSuccess, sellerId]);

  const logo = branding?.logo_light || branding?.logo_dark;
  const appName = branding?.nombre_app || "Sistema de Envíos";
  const primaryColor = branding?.color_primario || "#2F5496";

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5 bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="bg-white p-10 rounded-2xl text-center shadow-2xl max-w-[480px] w-full animate-[slideUp_0.6s_ease-out]">
          {/* Tenant Logo */}
          <div className="mb-8">
            {logo ? (
              <img src={logo} alt={appName} className="h-14 mx-auto object-contain" />
            ) : (
              <div
                className="w-14 h-14 rounded-xl mx-auto flex items-center justify-center text-white font-bold text-xl"
                style={{ backgroundColor: primaryColor }}
              >
                {appName.charAt(0)}
              </div>
            )}
          </div>

          {/* Success Icon */}
          <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center animate-[bounce_0.6s_ease-out_0.3s_both]"
               style={{ backgroundColor: `${primaryColor}15` }}>
            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke={primaryColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Conexión Exitosa!</h1>
          <p className="text-gray-500 text-sm mb-6">
            Tu tienda de <strong className="text-gray-700">Tiendanube</strong> se ha vinculado correctamente con <strong className="text-gray-700">{appName}</strong>.
          </p>

          <div className="h-px bg-gray-100 my-6" />

          {/* Next steps */}
          <div className="bg-gray-50 rounded-xl p-5 text-left space-y-3 mb-6">
            <p className="text-sm font-semibold text-gray-700">📋 Próximos pasos:</p>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs text-white font-medium" style={{ backgroundColor: primaryColor }}>1</span>
                Tus pedidos se sincronizarán automáticamente.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs text-white font-medium" style={{ backgroundColor: primaryColor }}>2</span>
                Podrás gestionar tus envíos desde el panel.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs text-white font-medium" style={{ backgroundColor: primaryColor }}>3</span>
                Tus clientes recibirán actualizaciones de estado.
              </li>
            </ul>
          </div>

          {/* Platform badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full text-xs text-blue-700 font-medium">
            <svg viewBox="0 0 200 40" xmlns="http://www.w3.org/2000/svg" className="w-20 h-auto">
              <path fill="#2F5496" d="M25 5C13.9 5 5 11.3 5 19s8.9 14 20 14 20-6.3 20-14S36.1 5 25 5zm-8.5 18.5c-1.4 0-2.5-1.1-2.5-2.5s1.1-2.5 2.5-2.5 2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5zm17 0c-1.4 0-2.5-1.1-2.5-2.5s1.1-2.5 2.5-2.5 2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5z"/>
              <text x="52" y="27" fontFamily="sans-serif" fontSize="20" fontWeight="600" fill="#2F5496">Tiendanube</text>
            </svg>
            Conectado
          </div>

          <p className="text-xs text-gray-400 mt-6">Esta ventana se cerrará automáticamente...</p>
          <div className="w-6 h-6 border-2 border-gray-200 rounded-full animate-spin mx-auto mt-3" style={{ borderTopColor: primaryColor }} />
        </div>

        <style>{`
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes bounce {
            0% { transform: scale(0); }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-gray-50">
      <div className="bg-white p-10 rounded-xl text-center shadow-lg max-w-[400px] w-full">
        <div className="w-16 h-16 rounded-full bg-red-50 mx-auto mb-4 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 className="text-red-600 mb-3 text-xl font-bold">{errorTitle}</h1>
        <p className="text-gray-500 text-sm leading-relaxed">{errorMessage}</p>
        <p className="text-xs text-gray-400 mt-5">Esta ventana se cerrará automáticamente...</p>
        <div className="w-6 h-6 border-2 border-gray-200 border-t-red-500 rounded-full animate-spin mx-auto mt-3" />
      </div>
    </div>
  );
};

export default TiendanubeOAuthResult;
