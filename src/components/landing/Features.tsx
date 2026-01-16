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
  Sparkles
} from "lucide-react";

const features = [
  {
    icon: Package,
    title: "Gestión de Envíos",
    description: "Crea, rastrea y gestiona todos tus envíos desde un solo lugar. Etiquetas, rótulos y EPOD automáticos.",
    gradient: "from-blue-500 to-cyan-500"
  },
  {
    icon: MapPin,
    title: "Tracking en Tiempo Real",
    description: "Seguimiento GPS de choferes y envíos. Tus clientes pueden rastrear sus paquetes con un código único.",
    gradient: "from-green-500 to-emerald-500"
  },
  {
    icon: Truck,
    title: "Optimización con IA",
    description: "Algoritmos inteligentes optimizan rutas automáticamente. Reduce costos y tiempos de entrega.",
    gradient: "from-purple-500 to-pink-500"
  },
  {
    icon: Users,
    title: "Multi-sucursal",
    description: "Gestiona múltiples sucursales con su propio personal, vehículos y zona de cobertura.",
    gradient: "from-orange-500 to-red-500"
  },
  {
    icon: CreditCard,
    title: "Liquidaciones Automáticas",
    description: "Calcula comisiones de choferes y sucursales. Genera liquidaciones con un solo click.",
    gradient: "from-yellow-500 to-orange-500"
  },
  {
    icon: BarChart3,
    title: "Analytics Avanzado",
    description: "Dashboard con métricas clave. Envíos, ingresos, rendimiento de choferes y predicciones.",
    gradient: "from-indigo-500 to-purple-500"
  },
  {
    icon: QrCode,
    title: "Escaneo QR",
    description: "Escanea códigos QR para recibir, entregar y transferir envíos. Compatible con móviles.",
    gradient: "from-teal-500 to-cyan-500"
  },
  {
    icon: Bell,
    title: "Notificaciones Push",
    description: "Alertas en tiempo real para nuevos envíos, entregas completadas e incidentes críticos.",
    gradient: "from-rose-500 to-pink-500"
  },
  {
    icon: Building2,
    title: "White Label",
    description: "Personaliza colores, logo y dominio. Tu marca, nuestra tecnología invisible.",
    gradient: "from-slate-500 to-zinc-500"
  }
];

const Features = () => {
  return (
    <section id="features" className="relative py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/30 to-background" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[100px]" />

      <div className="container relative z-10 mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Potenciado por tecnología de punta</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Todo lo que necesitas para{" "}
            <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              escalar tu operación
            </span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Herramientas profesionales diseñadas para empresas que quieren dominar la logística del futuro.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <div 
              key={i}
              className="group relative p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border hover:border-primary/50 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5"
            >
              {/* Gradient glow on hover */}
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
              
              {/* Icon */}
              <div className={`relative h-14 w-14 rounded-xl bg-gradient-to-br ${feature.gradient} p-[1px] mb-5`}>
                <div className="h-full w-full rounded-xl bg-background flex items-center justify-center group-hover:bg-transparent transition-colors duration-500">
                  <feature.icon className={`h-6 w-6 bg-gradient-to-br ${feature.gradient} bg-clip-text text-transparent group-hover:text-white transition-colors duration-500`} style={{ stroke: 'url(#gradient)' }} />
                </div>
              </div>
              
              <h3 className="text-xl font-semibold text-foreground mb-3 group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>

              {/* Arrow indicator */}
              <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className={`h-8 w-8 rounded-full bg-gradient-to-br ${feature.gradient} flex items-center justify-center`}>
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <p className="text-muted-foreground mb-4">
            ¿Necesitas una integración especial?
          </p>
          <a 
            href="mailto:soporte@tuapp.com" 
            className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
          >
            Hablemos de tu caso
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
};

export default Features;