import { 
  Package, 
  MapPin, 
  Truck, 
  Users, 
  CreditCard, 
  BarChart3,
  QrCode,
  Bell,
  Building2
} from "lucide-react";

const features = [
  {
    icon: Package,
    title: "Gestión de Envíos",
    description: "Crea, rastrea y gestiona todos tus envíos desde un solo lugar. Etiquetas, rótulos y EPOD automáticos."
  },
  {
    icon: MapPin,
    title: "Tracking en Tiempo Real",
    description: "Seguimiento GPS de choferes y envíos. Tus clientes pueden rastrear sus paquetes con un código único."
  },
  {
    icon: Truck,
    title: "Planificación de Rutas",
    description: "Optimiza las rutas de entrega automáticamente. Asigna envíos a choferes con un click."
  },
  {
    icon: Users,
    title: "Multi-sucursal",
    description: "Gestiona múltiples sucursales con su propio personal, vehículos y zona de cobertura."
  },
  {
    icon: CreditCard,
    title: "Liquidaciones Automáticas",
    description: "Calcula comisiones de choferes y sucursales. Genera liquidaciones con un solo click."
  },
  {
    icon: BarChart3,
    title: "Reportes y Estadísticas",
    description: "Dashboard con métricas clave. Envíos, ingresos, rendimiento de choferes y más."
  },
  {
    icon: QrCode,
    title: "Escaneo QR",
    description: "Escanea códigos QR para recibir, entregar y transferir envíos. Compatible con móviles."
  },
  {
    icon: Bell,
    title: "Notificaciones",
    description: "Alertas en tiempo real para nuevos envíos, entregas completadas e incidentes."
  },
  {
    icon: Building2,
    title: "White Label",
    description: "Personaliza colores, logo y dominio. Tu marca, nuestra tecnología."
  }
];

const Features = () => {
  return (
    <section id="features" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Todo lo que necesitas para tu operación
          </h2>
          <p className="text-xl text-muted-foreground">
            Herramientas profesionales para gestionar tu empresa de courier de principio a fin.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <div 
              key={i}
              className="group p-6 rounded-xl bg-card border border-border hover:border-primary/50 hover:shadow-lg transition-all duration-300"
            >
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
