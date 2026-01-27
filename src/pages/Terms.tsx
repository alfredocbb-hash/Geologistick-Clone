import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { Card, CardContent } from "@/components/ui/card";

const Terms = () => {
  return (
    <LegalPageLayout title="Términos de Servicio" lastUpdated="27 de enero de 2026">
      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">1. Aceptación de los Términos</h2>
        <p className="text-muted-foreground leading-relaxed">
          Al acceder y utilizar la plataforma Geologistick, usted acepta estos Términos de Servicio 
          en su totalidad. Si no está de acuerdo con alguno de estos términos, no debe utilizar 
          nuestros servicios.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">2. Descripción del Servicio</h2>
        <p className="text-muted-foreground leading-relaxed">
          Geologistick es una plataforma de gestión logística que permite a empresas y 
          particulares gestionar envíos, rastrear paquetes, administrar rutas de entrega 
          y conectar con plataformas de e-commerce. Nuestros servicios incluyen:
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-4">
          <li>Gestión y seguimiento de envíos</li>
          <li>Planificación de rutas de entrega</li>
          <li>Integración con tiendas online (TiendaNube, etc.)</li>
          <li>Gestión de choferes y vehículos</li>
          <li>Liquidaciones y facturación</li>
          <li>Reportes y analytics</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">3. Registro y Cuenta</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Para utilizar nuestros servicios, debe:
        </p>
        <Card className="bg-card/50">
          <CardContent className="pt-6">
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Ser mayor de edad según la legislación aplicable</li>
              <li>Proporcionar información precisa y actualizada</li>
              <li>Mantener la confidencialidad de sus credenciales de acceso</li>
              <li>Notificar inmediatamente cualquier uso no autorizado de su cuenta</li>
              <li>Ser responsable de todas las actividades realizadas bajo su cuenta</li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">4. Uso Aceptable</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Usted se compromete a NO utilizar la plataforma para:
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li>Actividades ilegales o fraudulentas</li>
          <li>Envío de mercancías prohibidas o restringidas</li>
          <li>Violar derechos de propiedad intelectual de terceros</li>
          <li>Interferir con el funcionamiento de la plataforma</li>
          <li>Recopilar información de otros usuarios sin consentimiento</li>
          <li>Transmitir virus o código malicioso</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">5. Tarifas y Pagos</h2>
        <p className="text-muted-foreground leading-relaxed">
          Las tarifas por nuestros servicios se establecen según el plan contratado y las 
          características de cada envío. Los pagos deben realizarse según los términos acordados. 
          Nos reservamos el derecho de modificar las tarifas con previo aviso. El incumplimiento 
          en los pagos puede resultar en la suspensión del servicio.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">6. Responsabilidad por Envíos</h2>
        <Card className="bg-card/50">
          <CardContent className="pt-6">
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong className="text-foreground">El remitente es responsable de:</strong>
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground mb-4">
              <li>El correcto embalaje de los productos</li>
              <li>La veracidad de la información de envío</li>
              <li>La declaración precisa del contenido y valor</li>
              <li>El cumplimiento de regulaciones de transporte</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Geologistick no se responsabiliza por:</strong> 
              Daños causados por embalaje inadecuado, información incorrecta proporcionada por 
              el usuario, o mercancías no declaradas correctamente.
            </p>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">7. Limitación de Responsabilidad</h2>
        <p className="text-muted-foreground leading-relaxed">
          En la máxima medida permitida por la ley, Geologistick no será responsable por 
          daños indirectos, incidentales, especiales o consecuentes. Nuestra responsabilidad 
          total no excederá el monto pagado por el servicio específico en cuestión. Esta 
          limitación no aplica en casos de negligencia grave o dolo.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">8. Propiedad Intelectual</h2>
        <p className="text-muted-foreground leading-relaxed">
          Todo el contenido de la plataforma, incluyendo software, diseño, logos, textos e 
          imágenes, es propiedad de Geologistick o sus licenciantes. No se permite la 
          reproducción, distribución o modificación sin autorización expresa por escrito.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">9. Terminación</h2>
        <p className="text-muted-foreground leading-relaxed">
          Podemos suspender o terminar su acceso a la plataforma en cualquier momento por 
          incumplimiento de estos términos, sin previo aviso. Usted puede cancelar su cuenta 
          en cualquier momento contactando a soporte. Las obligaciones pendientes sobrevivirán 
          a la terminación.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">10. Modificaciones</h2>
        <p className="text-muted-foreground leading-relaxed">
          Nos reservamos el derecho de modificar estos términos en cualquier momento. 
          Los cambios entrarán en vigor al ser publicados en esta página. El uso continuado 
          de la plataforma después de los cambios constituye aceptación de los nuevos términos.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">11. Ley Aplicable</h2>
        <p className="text-muted-foreground leading-relaxed">
          Estos términos se rigen por las leyes de la República Argentina. Cualquier 
          controversia será sometida a los tribunales competentes de la Ciudad Autónoma 
          de Buenos Aires.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-foreground mb-4">12. Contacto</h2>
        <p className="text-muted-foreground leading-relaxed">
          Para consultas sobre estos términos:
        </p>
        <Card className="bg-card/50 mt-4">
          <CardContent className="pt-6">
            <p className="text-foreground font-medium">Geologistick</p>
            <p className="text-muted-foreground">Email: <a href="mailto:soporte@geologistick.com" className="text-primary hover:underline">soporte@geologistick.com</a></p>
          </CardContent>
        </Card>
      </section>
    </LegalPageLayout>
  );
};

export default Terms;
