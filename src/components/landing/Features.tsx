import { 
  Package, 
  MapPin, 
  Truck, 
  Users, 
  CreditCard, 
  BarChart3,
  QrCode,
  Bell,
  Building2,
  ArrowUpRight
} from "lucide-react";
import { useLandingContent, defaultLandingContent } from "@/hooks/useLandingContent";

const features = [
  {
    icon: Package,
    title: "Gestión de Envíos",
    description: "Crea, rastrea y gestiona todos tus envíos desde un solo lugar. Etiquetas, rótulos y EPOD automáticos.",
    size: "large"
  },
  {
    icon: MapPin,
    title: "Tracking en Tiempo Real",
    description: "Seguimiento GPS de choferes y envíos. Tus clientes pueden rastrear sus paquetes con un código único.",
    size: "normal"
  },
  {
    icon: Truck,
    title: "Optimización con IA",
    description: "Algoritmos inteligentes optimizan rutas automáticamente.",
    size: "normal"
  },
  {
    icon: Users,
    title: "Multi-sucursal",
    description: "Gestiona múltiples sucursales con su propio personal, vehículos y zona de cobertura.",
    size: "normal"
  },
  {
    icon: CreditCard,
    title: "Liquidaciones Automáticas",
    description: "Calcula comisiones de choferes y sucursales. Genera liquidaciones con un solo click.",
    size: "large"
  },
  {
    icon: BarChart3,
    title: "Analytics Avanzado",
    description: "Dashboard con métricas clave. Envíos, ingresos, rendimiento de choferes y predicciones.",
    size: "normal"
  },
  {
    icon: QrCode,
    title: "Escaneo QR",
    description: "Escanea códigos QR para recibir, entregar y transferir envíos.",
    size: "normal"
  },
  {
    icon: Bell,
    title: "Notificaciones Push",
    description: "Alertas en tiempo real para nuevos envíos, entregas completadas e incidentes críticos.",
    size: "normal"
  },
  {
    icon: Building2,
    title: "White Label",
    description: "Personaliza colores, logo y dominio. Tu marca, nuestra tecnología invisible.",
    size: "normal"
  }
];

const Features = () => {
  const { data: content } = useLandingContent();
  const featuresContent = content?.features || defaultLandingContent.features!;

  return (
    <section id="features" className="relative py-32 overflow-hidden bg-muted dark:bg-[#050507]">
      {/* Subtle gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-[hsl(var(--geo-teal)/0.03)] rounded-full blur-[150px] opacity-50 dark:opacity-100" />

      <div className="container relative z-10 mx-auto px-4">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-20">
          <h2 className="text-5xl lg:text-6xl font-bold text-foreground dark:text-white mb-6 tracking-tight">
            Todo lo que necesitas
            <br />
            <span className="bg-gradient-to-r from-[hsl(var(--geo-teal))] to-[hsl(var(--geo-cyan))] bg-clip-text text-transparent">
              en un solo lugar
            </span>
          </h2>
          <p className="text-xl text-muted-foreground dark:text-gray-400">
            {featuresContent.subtitle}
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
          {features.map((feature, i) => {
            const isLarge = feature.size === "large";
            
            return (
              <div 
                key={i}
                className={`group relative p-8 rounded-2xl bg-background/50 dark:bg-white/[0.02] border border-border dark:border-white/5 hover:border-[hsl(var(--geo-teal)/0.3)] transition-all duration-500 hover:bg-background dark:hover:bg-white/[0.04] ${
                  isLarge ? 'md:col-span-2 lg:col-span-1' : ''
                }`}
                style={{
                  animationDelay: `${i * 0.1}s`
                }}
              >
                {/* Glow effect on hover */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: 'radial-gradient(400px at 50% 50%, hsl(174 50% 50% / 0.05), transparent 70%)'
                  }}
                />
                
                {/* Icon */}
                <div className="relative mb-6">
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[hsl(var(--geo-teal)/0.2)] to-[hsl(var(--geo-blue)/0.1)] flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <feature.icon className="h-7 w-7 text-[hsl(var(--geo-teal))]" />
                  </div>
                </div>
                
                {/* Content */}
                <h3 className="text-xl font-semibold text-foreground dark:text-white mb-3 group-hover:text-[hsl(var(--geo-teal))] transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground dark:text-gray-500 leading-relaxed">
                  {feature.description}
                </p>

                {/* Arrow */}
                <div className="absolute top-8 right-8 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                  <ArrowUpRight className="h-5 w-5 text-[hsl(var(--geo-teal))]" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
