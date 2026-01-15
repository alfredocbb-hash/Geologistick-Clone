import { Button } from "@/components/ui/button";
import { ArrowRight, Package, Truck, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

const Hero = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-secondary/10 py-20 lg:py-32">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text content */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Package className="h-4 w-4" />
              Sistema de Gestión de Envíos #1 en Argentina
            </div>
            
            <h1 className="text-4xl lg:text-6xl font-bold text-foreground leading-tight">
              Gestiona tu <span className="text-primary">logística</span> de forma inteligente
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-xl">
              Plataforma completa para empresas de courier y mensajería. Optimiza rutas, 
              gestiona entregas y liquida comisiones automáticamente.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild size="lg" className="text-lg px-8">
                <Link to="/login">
                  Comenzar gratis
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8">
                <a href="#pricing">Ver planes</a>
              </Button>
            </div>

            {/* Stats */}
            <div className="flex gap-8 pt-8 border-t border-border">
              <div>
                <p className="text-3xl font-bold text-foreground">+10K</p>
                <p className="text-sm text-muted-foreground">Envíos gestionados</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">98%</p>
                <p className="text-sm text-muted-foreground">Entregas exitosas</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">24/7</p>
                <p className="text-sm text-muted-foreground">Tracking en vivo</p>
              </div>
            </div>
          </div>

          {/* Visual element */}
          <div className="relative hidden lg:block">
            <div className="relative z-10 bg-card rounded-2xl shadow-2xl border border-border p-6 space-y-4">
              {/* Mock dashboard preview */}
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Truck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Panel de Control</p>
                    <p className="text-sm text-muted-foreground">Vista en tiempo real</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-status-success/20 text-status-success text-sm">
                  En línea
                </span>
              </div>
              
              {/* Mock shipment cards */}
              {[
                { id: "ENV-001", status: "En camino", address: "Av. Corrientes 1234" },
                { id: "ENV-002", status: "Entregado", address: "Calle Florida 567" },
                { id: "ENV-003", status: "Pendiente", address: "Av. 9 de Julio 890" },
              ].map((shipment, i) => (
                <div 
                  key={i} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground text-sm">{shipment.id}</p>
                      <p className="text-xs text-muted-foreground">{shipment.address}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    shipment.status === "Entregado" 
                      ? "bg-status-success/20 text-status-success"
                      : shipment.status === "En camino"
                      ? "bg-status-warning/20 text-status-warning"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {shipment.status}
                  </span>
                </div>
              ))}
            </div>
            
            {/* Decorative elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/20 rounded-xl rotate-12 -z-10" />
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-secondary/20 rounded-xl -rotate-12 -z-10" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
