import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";

const plans = [
  {
    name: "Básico",
    price: "15.000",
    description: "Para emprendedores y pequeñas operaciones",
    features: [
      "Hasta 100 envíos/mes",
      "1 sucursal",
      "3 usuarios",
      "Tracking básico",
      "Soporte por email"
    ],
    popular: false,
    priceId: "price_1RWNafRvplE3pT7pBlZIl7Ud"
  },
  {
    name: "Profesional",
    price: "35.000",
    description: "Para empresas en crecimiento",
    features: [
      "Hasta 500 envíos/mes",
      "3 sucursales",
      "10 usuarios",
      "Tracking GPS en vivo",
      "Planificación de rutas",
      "Liquidaciones automáticas",
      "Soporte prioritario"
    ],
    popular: true,
    priceId: "price_1RWNb7RvplE3pT7pbp0aqzDo"
  },
  {
    name: "Empresarial",
    price: "75.000",
    description: "Para grandes operaciones",
    features: [
      "Envíos ilimitados",
      "Sucursales ilimitadas",
      "Usuarios ilimitados",
      "White label completo",
      "API de integración",
      "Facturación electrónica",
      "Soporte 24/7",
      "Capacitación incluida"
    ],
    popular: false,
    priceId: "price_1RWNbURvplE3pT7pSIJ2AFNQ"
  }
];

const Pricing = () => {
  return (
    <section id="pricing" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Planes simples y transparentes
          </h2>
          <p className="text-xl text-muted-foreground">
            Elige el plan que mejor se adapte a tu operación. Todos incluyen 14 días de prueba gratis.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, i) => (
            <div 
              key={i}
              className={`relative p-8 rounded-2xl border ${
                plan.popular 
                  ? "border-primary bg-card shadow-xl scale-105" 
                  : "border-border bg-card hover:border-primary/50"
              } transition-all duration-300`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                    Más popular
                  </span>
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>
                <p className="text-muted-foreground mb-4">{plan.description}</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-foreground">${plan.price}</span>
                  <span className="text-muted-foreground">/mes</span>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                asChild
                className="w-full" 
                variant={plan.popular ? "default" : "outline"}
                size="lg"
              >
                <Link to="/login">
                  Comenzar prueba gratis
                </Link>
              </Button>
            </div>
          ))}
        </div>

        <p className="text-center text-muted-foreground mt-8">
          ¿Necesitas un plan personalizado? <a href="mailto:soporte@tuapp.com" className="text-primary hover:underline">Contáctanos</a>
        </p>
      </div>
    </section>
  );
};

export default Pricing;
