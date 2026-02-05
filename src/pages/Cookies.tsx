import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { Card, CardContent } from "@/components/ui/card";

const Cookies = () => {
  return (
    <LegalPageLayout title="Política de Cookies" lastUpdated="27 de enero de 2026">
      <section>
        <h2 className="text-xl font-semibold text-white mb-4">1. ¿Qué son las Cookies?</h2>
        <p className="text-gray-400 leading-relaxed">
          Las cookies son pequeños archivos de texto que se almacenan en su dispositivo 
          cuando visita un sitio web. Estas permiten que el sitio recuerde sus acciones 
          y preferencias durante un período de tiempo, para que no tenga que volver a 
          introducirlos cada vez que regrese al sitio.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white mb-4">2. Tipos de Cookies que Utilizamos</h2>
        
        <div className="space-y-4">
          <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-white mb-2">Cookies Esenciales</h3>
              <p className="text-gray-400 text-sm">
                Son necesarias para el funcionamiento básico de la plataforma. Permiten 
                navegar por el sitio, usar funciones de seguridad y mantener su sesión iniciada.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                <strong className="text-gray-400">Duración:</strong> Sesión / 30 días
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-white mb-2">Cookies de Preferencias</h3>
              <p className="text-gray-400 text-sm">
                Recuerdan sus configuraciones y preferencias, como el idioma seleccionado 
                o la región desde donde accede.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                <strong className="text-gray-400">Duración:</strong> 1 año
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-white mb-2">Cookies de Análisis</h3>
              <p className="text-gray-400 text-sm">
                Nos ayudan a entender cómo los visitantes interactúan con la plataforma, 
                recopilando información de forma anónima para mejorar nuestros servicios.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                <strong className="text-gray-400">Duración:</strong> 2 años
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-white mb-2">Cookies de Autenticación</h3>
              <p className="text-gray-400 text-sm">
                Mantienen su sesión segura y permiten que la plataforma le reconozca 
                cuando regresa, evitando que tenga que iniciar sesión repetidamente.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                <strong className="text-gray-400">Duración:</strong> 7 días (o hasta cerrar sesión)
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white mb-4">3. Cookies de Terceros</h2>
        <p className="text-gray-400 leading-relaxed mb-4">
          Utilizamos servicios de terceros que pueden establecer sus propias cookies:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li><strong className="text-white">Google Maps:</strong> Para funcionalidades de mapas y geolocalización</li>
          <li><strong className="text-white">Stripe/MercadoPago:</strong> Para procesamiento seguro de pagos</li>
          <li><strong className="text-white">Supabase:</strong> Para autenticación y gestión de sesiones</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white mb-4">4. Cómo Gestionar las Cookies</h2>
        <p className="text-gray-400 leading-relaxed mb-4">
          Puede controlar y/o eliminar las cookies según sus preferencias. Tenga en cuenta 
          que deshabilitar ciertas cookies puede afectar la funcionalidad de la plataforma.
        </p>
        <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-white mb-3">Configuración del Navegador</h3>
            <p className="text-gray-400 text-sm mb-4">
              La mayoría de los navegadores permiten:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-400 text-sm">
              <li>Ver las cookies almacenadas y eliminarlas individualmente</li>
              <li>Bloquear cookies de terceros</li>
              <li>Bloquear todas las cookies de sitios específicos</li>
              <li>Bloquear todas las cookies</li>
              <li>Eliminar todas las cookies al cerrar el navegador</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white mb-4">5. Almacenamiento Local</h2>
        <p className="text-gray-400 leading-relaxed">
          Además de las cookies, utilizamos almacenamiento local (localStorage) para 
          guardar preferencias de la aplicación y datos de sesión. Este almacenamiento 
          funciona de manera similar a las cookies pero permanece hasta que usted lo 
          elimine manualmente o limpie los datos del navegador.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white mb-4">6. Consentimiento</h2>
        <p className="text-gray-400 leading-relaxed">
          Al utilizar nuestra plataforma, usted consiente el uso de cookies según esta política. 
          Las cookies esenciales son necesarias para el funcionamiento y no requieren 
          consentimiento adicional. Para las demás categorías, puede gestionar sus preferencias 
          en cualquier momento.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white mb-4">7. Actualizaciones</h2>
        <p className="text-gray-400 leading-relaxed">
          Esta política puede actualizarse ocasionalmente para reflejar cambios en nuestras 
          prácticas o por otros motivos operativos, legales o regulatorios. Le recomendamos 
          revisar esta página periódicamente.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white mb-4">8. Contacto</h2>
        <p className="text-gray-400 leading-relaxed">
          Para preguntas sobre nuestra política de cookies:
        </p>
        <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm mt-4">
          <CardContent className="pt-6">
            <p className="text-white font-medium">Geologistick</p>
            <p className="text-gray-400">Email: <a href="mailto:soporte@geologistick.com" className="text-[hsl(174_100%_42%)] hover:underline">soporte@geologistick.com</a></p>
          </CardContent>
        </Card>
      </section>
    </LegalPageLayout>
  );
};

export default Cookies;
