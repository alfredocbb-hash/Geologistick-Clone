import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { Card, CardContent } from "@/components/ui/card";

const Privacy = () => {
  return (
    <LegalPageLayout title="Política de Privacidad" lastUpdated="27 de enero de 2026">
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">1. Información General</h2>
        <p className="text-muted-foreground leading-relaxed">
          En Geologistick, nos comprometemos a proteger la privacidad de nuestros usuarios. 
          Esta Política de Privacidad describe cómo recopilamos, usamos, almacenamos y protegemos 
          su información personal cuando utiliza nuestra plataforma de gestión logística.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">2. Datos que Recopilamos</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Recopilamos los siguientes tipos de información:
        </p>
        <Card className="bg-card/50">
          <CardContent className="pt-6">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong className="text-foreground">Datos de identificación:</strong> Nombre, apellido, DNI/CUIT</li>
              <li><strong className="text-foreground">Datos de contacto:</strong> Email, teléfono, dirección</li>
              <li><strong className="text-foreground">Datos de envío:</strong> Direcciones de origen y destino, descripción de paquetes</li>
              <li><strong className="text-foreground">Datos de ubicación:</strong> Coordenadas GPS para seguimiento de entregas</li>
              <li><strong className="text-foreground">Datos de uso:</strong> Interacciones con la plataforma, preferencias</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">3. Uso de la Información</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Utilizamos su información para:
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li>Procesar y gestionar envíos logísticos</li>
          <li>Proporcionar seguimiento en tiempo real de paquetes</li>
          <li>Comunicarnos con usted sobre el estado de sus envíos</li>
          <li>Mejorar nuestros servicios y experiencia de usuario</li>
          <li>Cumplir con obligaciones legales y fiscales</li>
          <li>Generar facturación y documentación de envíos</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">4. Integraciones con Plataformas de E-commerce</h2>
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="pt-6">
            <p className="text-muted-foreground leading-relaxed mb-4">
              Cuando conectas tu tienda de <strong className="text-foreground">TiendaNube</strong> u otra 
              plataforma de e-commerce, accedemos a:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4">
              <li>Información de pedidos (productos, precios, direcciones de envío)</li>
              <li>Datos del destinatario (nombre, teléfono, email)</li>
              <li>Estado de los pedidos y actualizaciones de fulfillment</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong className="text-foreground">Usamos esta información para:</strong>
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4">
              <li>Crear automáticamente envíos basados en tus pedidos</li>
              <li>Actualizar el estado de entrega en tu tienda</li>
              <li>Generar etiquetas y documentación de envío</li>
              <li>Calcular tarifas de envío en tiempo real</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Si desinstalas la aplicación:</strong> Eliminamos 
              inmediatamente todos los tokens de acceso. Los datos históricos de pedidos pueden 
              conservarse según los términos de retención acordados con el cliente.
            </p>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">5. Almacenamiento y Seguridad</h2>
        <p className="text-muted-foreground leading-relaxed">
          Sus datos se almacenan en servidores seguros con encriptación de nivel empresarial. 
          Implementamos medidas de seguridad técnicas y organizativas para proteger su información 
          contra acceso no autorizado, pérdida o alteración. Los datos se conservan durante el 
          tiempo necesario para cumplir con los fines descritos y las obligaciones legales aplicables.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">6. Compartir Información</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Podemos compartir su información con:
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li><strong className="text-foreground">Empresas de logística terciarizadas:</strong> Para completar entregas</li>
          <li><strong className="text-foreground">Proveedores de servicios:</strong> Procesamiento de pagos, hosting, comunicaciones</li>
          <li><strong className="text-foreground">Autoridades:</strong> Cuando sea requerido por ley</li>
        </ul>
        <p className="text-muted-foreground leading-relaxed mt-4">
          No vendemos ni alquilamos su información personal a terceros con fines de marketing.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">7. Sus Derechos</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Usted tiene derecho a:
        </p>
        <Card className="bg-card/50">
          <CardContent className="pt-6">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li><strong className="text-foreground">Acceso:</strong> Solicitar una copia de sus datos personales</li>
              <li><strong className="text-foreground">Rectificación:</strong> Corregir datos inexactos o incompletos</li>
              <li><strong className="text-foreground">Cancelación:</strong> Solicitar la eliminación de sus datos</li>
              <li><strong className="text-foreground">Oposición:</strong> Oponerse al procesamiento de sus datos</li>
              <li><strong className="text-foreground">Portabilidad:</strong> Recibir sus datos en formato estructurado</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">8. Contacto</h2>
        <p className="text-muted-foreground leading-relaxed">
          Para ejercer sus derechos o realizar consultas sobre privacidad, contáctenos en:
        </p>
        <Card className="bg-card/50 mt-4">
          <CardContent className="pt-6">
            <p className="text-foreground font-medium">Geologistick</p>
            <p className="text-muted-foreground">Email: <a href="mailto:soporte@geologistick.com" className="text-primary hover:underline">soporte@geologistick.com</a></p>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">9. Cambios a esta Política</h2>
        <p className="text-muted-foreground leading-relaxed">
          Nos reservamos el derecho de modificar esta política en cualquier momento. 
          Los cambios serán publicados en esta página con la fecha de actualización. 
          Le recomendamos revisar periódicamente esta política.
        </p>
      </section>
    </LegalPageLayout>
  );
};

export default Privacy;
