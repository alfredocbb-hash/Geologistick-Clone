import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

const MercadoLibreOAuthResult = () => {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status");
  const sellerId = searchParams.get("seller_id");
  const errorTitle = searchParams.get("title") || "Error de Conexión";
  const errorMessage = searchParams.get("message") || "Ocurrió un error inesperado.";

  const isSuccess = status === "success";

  useEffect(() => {
    const timer = setTimeout(() => {
      if (window.opener) {
        window.opener.postMessage(
          isSuccess
            ? { type: "mercadolibre-oauth-success", sellerId }
            : { type: "mercadolibre-oauth-error" },
          "*"
        );
      }
      window.close();
    }, 4000);
    return () => clearTimeout(timer);
  }, [isSuccess, sellerId]);

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5" style={{ background: "linear-gradient(135deg, #FFF159 0%, #FFE600 100%)" }}>
        <div className="bg-white p-12 rounded-[20px] text-center shadow-2xl max-w-[440px] w-full animate-[slideUp_0.6s_ease-out]">
          <div className="mb-6">
            <svg viewBox="0 0 134 34" xmlns="http://www.w3.org/2000/svg" className="w-[180px] h-auto mx-auto">
              <path fill="#FFE600" d="M67 0C52.8 0 41.5 7.6 41.5 17s11.3 17 25.5 17 25.5-7.6 25.5-17S81.2 0 67 0z"/>
              <path fill="#2D3277" d="M67.1 6.5c-9.1 0-16.4 4.7-16.4 10.5s7.4 10.5 16.4 10.5c9.1 0 16.4-4.7 16.4-10.5S76.1 6.5 67.1 6.5zm-5.7 12.7c-1.4 0-2.5-1.4-2.5-3.1s1.1-3.1 2.5-3.1 2.5 1.4 2.5 3.1-1.2 3.1-2.5 3.1zm11.3 0c-1.4 0-2.5-1.4-2.5-3.1s1.1-3.1 2.5-3.1 2.5 1.4 2.5 3.1-1.1 3.1-2.5 3.1z"/>
              <path fill="#2D3277" d="M7.4 17.8V26H3.1v-5.2H0V17h3.1v-3.2c0-3.7 2-5.8 5.7-5.8 1 0 2.1.2 2.8.4v3.5c-.5-.2-1.2-.3-1.9-.3-1.6 0-2.3.8-2.3 2.5v3h3.8v3.7H7.4zm13.7-9.4l-.1 3.3c-.4-.1-1-.1-1.3-.1-2.2 0-3.5 1.2-3.5 4V26h-4.1V8.6h3.9v2.5c.8-1.8 2.3-2.8 4.2-2.8.4 0 .7 0 .9.1zm10.7 15c-.9 1.7-2.8 2.9-5.3 2.9-4.3 0-7.3-3.2-7.3-8.2 0-4.8 3-8.4 7.3-8.4 2.5 0 4.3 1.2 5.2 2.9V10h4.1v16h-4v-2.6zm-4.2-.1c2.3 0 4.1-1.9 4.1-4.9 0-3.1-1.8-4.9-4.1-4.9s-4 1.8-4 4.9c0 3 1.7 4.9 4 4.9z"/>
              <path fill="#2D3277" d="M129.4 23.4c-.9 1.7-2.8 2.9-5.3 2.9-4.3 0-7.3-3.2-7.3-8.2 0-4.8 3-8.4 7.3-8.4 2.5 0 4.3 1.2 5.2 2.9V10h4.1v16h-4v-2.6zm-4.2-.1c2.3 0 4.1-1.9 4.1-4.9 0-3.1-1.8-4.9-4.1-4.9s-4 1.8-4 4.9c0 3 1.7 4.9 4 4.9zm-16.6.5c2.2 0 3.6-1 4.1-2.8h4.4c-.6 3.8-3.8 6.3-8.5 6.3-5.4 0-8.8-3.6-8.8-8.8 0-5.2 3.4-8.8 8.8-8.8 4.7 0 7.9 2.5 8.5 6.3h-4.4c-.5-1.8-1.9-2.8-4.1-2.8-2.8 0-4.5 2.1-4.5 5.3 0 3.2 1.7 5.3 4.5 5.3z"/>
              <path fill="#2D3277" d="M96.2 9.8c4.9 0 8.4 3.6 8.4 8.6 0 5-3.5 8.6-8.4 8.6s-8.4-3.6-8.4-8.6c0-5 3.5-8.6 8.4-8.6zm0 13.5c2.6 0 4.2-2 4.2-4.9s-1.6-4.9-4.2-4.9-4.2 2-4.2 4.9 1.6 4.9 4.2 4.9z"/>
            </svg>
          </div>
          <div className="text-7xl mb-4 animate-[bounce_0.6s_ease-out_0.3s_both]">✅</div>
          <h1 className="text-[#1a1a1a] mb-4 text-[28px] font-bold">¡Conexión Exitosa!</h1>
          <p className="text-[#4b5563] text-base leading-relaxed mb-7">
            Tu tienda de <strong>MercadoLibre</strong> se ha vinculado correctamente con el sistema de envíos.
          </p>
          <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent my-6" />
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-xl mb-6">
            <div className="text-green-800 font-semibold mb-2 text-base">🎉 ¡Gracias por confiar en nosotros!</div>
            <div className="text-green-700 text-sm leading-relaxed">
              A partir de ahora, recibirás tus pedidos automáticamente y podrás gestionar tus envíos de forma sencilla.
            </div>
          </div>
          <p className="text-[13px] text-gray-400 mt-5">Esta ventana se cerrará automáticamente...</p>
          <div className="w-7 h-7 border-[3px] border-gray-200 border-t-[#FFE600] rounded-full animate-spin mx-auto mt-4" />
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
    <div className="min-h-screen flex items-center justify-center p-5 bg-gray-100">
      <div className="bg-white p-10 rounded-xl text-center shadow-lg max-w-[400px] w-full">
        <h1 className="text-red-500 mb-4 text-2xl font-bold">⚠️ {errorTitle}</h1>
        <p className="text-gray-500 leading-relaxed">{errorMessage}</p>
        <p className="text-[13px] text-gray-400 mt-5">Esta ventana se cerrará automáticamente...</p>
        <div className="w-7 h-7 border-[3px] border-gray-200 border-t-red-500 rounded-full animate-spin mx-auto mt-4" />
      </div>
    </div>
  );
};

export default MercadoLibreOAuthResult;
