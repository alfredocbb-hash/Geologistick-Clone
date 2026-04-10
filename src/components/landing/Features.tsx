import { 
  FileText, 
  MapPin, 
  Calculator, 
  ShoppingBag, 
  QrCode, 
  Tag,
  BarChart3,
  Smartphone
} from "lucide-react";
import { useLandingContent, defaultLandingContent } from "@/hooks/useLandingContent";

const features = [
  {
    icon: FileText,
    title: "Hojas de ruta y asignación de envíos",
    description: "Creá hojas de ruta, asigná envíos a choferes y gestioná todo el flujo de despacho desde un solo panel. Reasigná en tiempo real según disponibilidad y zona de cobertura.",
  },
  {
    icon: MapPin,
    title: "Seguimiento GPS en tiempo real",
    description: "Seguí la ubicación de cada chofer en el mapa en vivo. Compartí un link de tracking público para que tus clientes vean el estado de su envío sin necesidad de llamar.",
  },
  {
    icon: Calculator,
    title: "Liquidaciones automáticas",
    description: "Calculá comisiones de choferes, sucursales y clientes de forma automática. Definí porcentajes, montos fijos y conceptos personalizados. Generá PDFs de liquidación con un click.",
  },
  {
    icon: ShoppingBag,
    title: "Integración con Mercado Libre y Tiendanube",
    description: "Sincronizá pedidos de Mercado Libre y Tiendanube automáticamente. Actualizá estados de envío en la plataforma de origen sin intervención manual.",
  },
  {
    icon: QrCode,
    title: "Escaneo QR y digitalización",
    description: "Escaneá códigos QR para recibir, transferir y entregar paquetes. Registrá cada movimiento con trazabilidad completa desde la recepción hasta la entrega.",
  },
  {
    icon: Tag,
    title: "Etiquetas y rótulos automáticos",
    description: "Generá etiquetas con código QR, rótulos de despacho y comprobantes de entrega (EPOD) de forma automática. Imprimí en lote o uno por uno.",
  },
  {
    icon: BarChart3,
    title: "Analytics y reportes avanzados",
    description: "Dashboard con métricas clave: envíos por día, ingresos, rendimiento de choferes, predicción de demanda y análisis de productividad por sucursal.",
  },
  {
    icon: Smartphone,
    title: "App móvil para choferes",
    description: "Los choferes gestionan sus rutas, confirman entregas con foto y firma, registran cobros contra entrega y reportan incidentes desde su celular.",
  },
];

const Features = () => {
  const { data: content } = useLandingContent();
  const featuresContent = content?.features || defaultLandingContent.features!;

  return (
    <section id="features" className="relative py-28 overflow-hidden bg-background dark:bg-[#050507]">
      <div className="container relative z-10 mx-auto px-4">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-20">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground dark:text-white mb-6 tracking-tight">
            Funcionalidades
            <span className="bg-gradient-to-r from-[hsl(var(--geo-teal))] to-[hsl(var(--geo-cyan))] bg-clip-text text-transparent"> completas</span>
          </h2>
          <p className="text-lg text-muted-foreground dark:text-gray-400">
            {featuresContent.subtitle}
          </p>
        </div>

        {/* Feature cards - 2 columns, large cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {features.map((feature, i) => (
            <div 
              key={i}
              className="group relative p-8 rounded-2xl bg-card dark:bg-white/[0.02] border border-border dark:border-white/5 hover:border-[hsl(var(--geo-teal)/0.3)] transition-all duration-300 hover:shadow-lg"
            >
              <div className="flex gap-5">
                <div className="shrink-0">
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[hsl(var(--geo-teal)/0.15)] to-[hsl(var(--geo-blue)/0.1)] flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <feature.icon className="h-7 w-7 text-[hsl(var(--geo-teal))]" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground dark:text-white mb-2 group-hover:text-[hsl(var(--geo-teal))] transition-colors duration-300">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground dark:text-gray-500 leading-relaxed text-sm">
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
