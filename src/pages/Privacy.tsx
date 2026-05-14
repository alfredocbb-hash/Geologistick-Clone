import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { SEO } from "@/components/seo/SEO";

const Privacy = () => {
  return (
    <>
      <SEO
        title="Política de Privacidad — Geologistick"
        description="Cómo Geologistick recopila, utiliza y protege tus datos personales y de envíos en su plataforma de gestión logística."
        path="/privacy"
      />
    <LegalPageLayout title="Política de Privacidad" lastUpdated="27 de enero de 2026">
      <section>
        <h2 className="text-xl font-semibold text-white mb-4">1. Información General</h2>
        <p className="text-gray-400 leading-relaxed">
          En Geologistick, nos comprometemos a proteger la privacidad de nuestros usuarios. 
          Esta Política de Privacidad describe cómo recopilamos, usamos, almacenamos y protegemos 
          su información personal cuando utiliza nuestra plataforma de gestión logística.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white mb-4">2. Datos que Recopilamos</h2>
        <p className="text-gray-400 leading-relaxed mb-4">
          Recopilamos los siguientes tipos de información:
        </p>
        <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm">
          <CardContent className="pt-6">
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li><strong className="text-white">Datos de identificación:</strong> Nombre, apellido, DNI/CUIT</li>
              <li><strong className="text-white">Datos de contacto:</strong> Email, teléfono, dirección</li>
              <li><strong className="text-white">Datos de envío:</strong> Direcciones de origen y destino, descripción de paquetes</li>
              <li><strong className="text-white">Datos de ubicación:</strong> Coordenadas GPS para seguimiento de entregas</li>
              <li><strong className="text-white">Datos de uso:</strong> Interacciones con la plataforma, preferencias</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white mb-4">3. Uso de la Información</h2>
        <p className="text-gray-400 leading-relaxed mb-4">
          Utilizamos su información para:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li>Procesar y gestionar envíos logísticos</li>
          <li>Proporcionar seguimiento en tiempo real de paquetes</li>
          <li>Comunicarnos con usted sobre el estado de sus envíos</li>
          <li>Mejorar nuestros servicios y experiencia de usuario</li>
          <li>Cumplir con obligaciones legales y fiscales</li>
          <li>Generar facturación y documentación de envíos</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white mb-4">4. Integraciones con Plataformas de E-commerce</h2>
        <Card className="bg-[hsl(174_100%_42%/0.08)] border-[hsl(174_100%_42%/0.2)] backdrop-blur-sm">
          <CardContent className="pt-6">
            <p className="text-gray-400 leading-relaxed mb-4">
              Cuando conectas tu tienda de <strong className="text-white">TiendaNube</strong> u otra 
              plataforma de e-commerce, accedemos a:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-400 mb-4">
              <li>Información de pedidos (productos, precios, direcciones de envío)</li>
              <li>Datos del destinatario (nombre, teléfono, email)</li>
              <li>Estado de los pedidos y actualizaciones de fulfillment</li>
            </ul>
            <p className="text-gray-400 leading-relaxed mb-4">
              <strong className="text-white">Usamos esta información para:</strong>
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-400 mb-4">
              <li>Crear automáticamente envíos basados en tus pedidos</li>
              <li>Actualizar el estado de entrega en tu tienda</li>
              <li>Generar etiquetas y documentación de envío</li>
              <li>Calcular tarifas de envío en tiempo real</li>
            </ul>
            <p className="text-gray-400 leading-relaxed">
              <strong className="text-white">Si desinstalas la aplicación:</strong> Eliminamos 
              inmediatamente todos los tokens de acceso. Los datos históricos de pedidos pueden 
              conservarse según los términos de retención acordados con el cliente.
            </p>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white mb-4">5. Almacenamiento y Seguridad</h2>
        <p className="text-gray-400 leading-relaxed">
          Sus datos se almacenan en servidores seguros con encriptación de nivel empresarial. 
          Implementamos medidas de seguridad técnicas y organizativas para proteger su información 
          contra acceso no autorizado, pérdida o alteración. Los datos se conservan durante el 
          tiempo necesario para cumplir con los fines descritos y las obligaciones legales aplicables.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white mb-4">6. Compartir Información</h2>
        <p className="text-gray-400 leading-relaxed mb-4">
          Podemos compartir su información con:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-400">
          <li><strong className="text-white">Empresas de logística terciarizadas:</strong> Para completar entregas</li>
          <li><strong className="text-white">Proveedores de servicios:</strong> Procesamiento de pagos, hosting, comunicaciones</li>
          <li><strong className="text-white">Autoridades:</strong> Cuando sea requerido por ley</li>
        </ul>
        <p className="text-gray-400 leading-relaxed mt-4">
          No vendemos ni alquilamos su información personal a terceros con fines de marketing.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white mb-4">7. Sus Derechos</h2>
        <p className="text-gray-400 leading-relaxed mb-4">
          Usted tiene derecho a:
        </p>
        <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm">
          <CardContent className="pt-6">
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li><strong className="text-white">Acceso:</strong> Solicitar una copia de sus datos personales</li>
              <li><strong className="text-white">Rectificación:</strong> Corregir datos inexactos o incompletos</li>
              <li><strong className="text-white">Cancelación:</strong> Solicitar la eliminación de sus datos</li>
              <li><strong className="text-white">Oposición:</strong> Oponerse al procesamiento de sus datos</li>
              <li><strong className="text-white">Portabilidad:</strong> Recibir sus datos en formato estructurado</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white mb-4">8. Contacto</h2>
        <p className="text-gray-400 leading-relaxed">
          Para ejercer sus derechos o realizar consultas sobre privacidad, contáctenos en:
        </p>
        <Card className="bg-white/[0.02] border-white/10 backdrop-blur-sm mt-4">
          <CardContent className="pt-6">
            <p className="text-white font-medium">Geologistick</p>
            <p className="text-gray-400">Email: <a href="mailto:soporte@geologistick.com" className="text-[hsl(174_100%_42%)] hover:underline">soporte@geologistick.com</a></p>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white mb-4">9. Cambios a esta Política</h2>
        <p className="text-gray-400 leading-relaxed">
          Nos reservamos el derecho de modificar esta política en cualquier momento. 
          Los cambios serán publicados en esta página con la fecha de actualización. 
          Le recomendamos revisar periódicamente esta política.
        </p>
      </section>
    </LegalPageLayout>
  );
};

export default Privacy;
