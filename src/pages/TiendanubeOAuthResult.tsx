import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

const TiendanubeOAuthResult = () => {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status");
  const sellerId = searchParams.get("seller_id");
  const errorTitle = searchParams.get("title") || "Error";
  const errorMessage = searchParams.get("message") || "Ocurrió un error inesperado.";

  const isSuccess = status === "success";

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
    }, 4000);
    return () => clearTimeout(timer);
  }, [isSuccess, sellerId]);

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5" style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
        <div className="bg-white p-12 rounded-[20px] text-center shadow-2xl max-w-[440px] w-full animate-[slideUp_0.6s_ease-out]">
          <div className="mb-6">
            <svg viewBox="0 0 200 40" xmlns="http://www.w3.org/2000/svg" className="w-[200px] h-auto mx-auto">
              <path fill="#2F5496" d="M25 5C13.9 5 5 11.3 5 19s8.9 14 20 14 20-6.3 20-14S36.1 5 25 5zm-8.5 18.5c-1.4 0-2.5-1.1-2.5-2.5s1.1-2.5 2.5-2.5 2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5zm17 0c-1.4 0-2.5-1.1-2.5-2.5s1.1-2.5 2.5-2.5 2.5 1.1 2.5 2.5-1.1 2.5-2.5 2.5z"/>
              <text x="52" y="27" fontFamily="-apple-system, BlinkMacSystemFont, sans-serif" fontSize="20" fontWeight="600" fill="#2F5496">Tiendanube</text>
            </svg>
          </div>
          <div className="text-7xl mb-4 animate-[bounce_0.6s_ease-out_0.3s_both]">✅</div>
          <h1 className="text-[#1a1a1a] mb-4 text-[28px] font-bold">¡Conexión Exitosa!</h1>
          <p className="text-[#4b5563] text-base leading-relaxed mb-7">
            Tu tienda de <strong>Tiendanube</strong> se ha vinculado correctamente con el sistema de envíos.
          </p>
          <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent my-6" />
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-xl mb-6">
            <div className="text-green-800 font-semibold mb-2 text-base">🎉 ¡Gracias por confiar en nosotros!</div>
            <div className="text-green-700 text-sm leading-relaxed">
              A partir de ahora, recibirás tus pedidos automáticamente y podrás gestionar tus envíos de forma sencilla.
            </div>
          </div>
          <p className="text-[13px] text-gray-400 mt-5">Esta ventana se cerrará automáticamente...</p>
          <div className="w-7 h-7 border-[3px] border-gray-200 border-t-[#667eea] rounded-full animate-spin mx-auto mt-4" />
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

export default TiendanubeOAuthResult;
