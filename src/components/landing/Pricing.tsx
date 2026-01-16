import { Button } from "@/components/ui/button";
import { Check, Sparkles, Zap } from "lucide-react";
import { Link } from "react-router-dom";

const plans = [
  {
    name: "Starter",
    price: "15.000",
    description: "Para emprendedores que empiezan",
    features: [
      "Hasta 100 envíos/mes",
      "1 sucursal",
      "3 usuarios",
      "Tracking básico",
      "Soporte por email"
    ],
    popular: false,
    priceId: "price_1RWNafRvplE3pT7pBlZIl7Ud",
    gradient: "from-slate-500 to-slate-600"
  },
  {
    name: "Pro",
    price: "35.000",
    description: "Para empresas en crecimiento",
    features: [
      "Hasta 500 envíos/mes",
      "3 sucursales",
      "10 usuarios",
      "Tracking GPS en vivo",
      "Planificación de rutas con IA",
      "Liquidaciones automáticas",
      "Soporte prioritario"
    ],
    popular: true,
    priceId: "price_1RWNb7RvplE3pT7pbp0aqzDo",
    gradient: "from-primary to-purple-600"
  },
  {
    name: "Enterprise",
    price: "75.000",
    description: "Para grandes operaciones",
    features: [
      "Envíos ilimitados",
      "Sucursales ilimitadas",
      "Usuarios ilimitados",
      "White label completo",
      "API de integración",
      "Facturación electrónica",
      "Soporte 24/7 dedicado",
      "Capacitación incluida"
    ],
    popular: false,
    priceId: "price_1RWNbURvplE3pT7pSIJ2AFNQ",
    gradient: "from-amber-500 to-orange-600"
  }
];

const Pricing = () => {
  return (
    <section id="pricing" className="relative py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#0a0a0f]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1a1a2e_1px,transparent_1px),linear-gradient(to_bottom,#1a1a2e_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[150px]" />

      <div className="container relative z-10 mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">14 días gratis en todos los planes</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
            Precios{" "}
            <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              transparentes
            </span>
          </h2>
          <p className="text-xl text-gray-400">
            Sin sorpresas ni costos ocultos. Escala cuando lo necesites.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, i) => (
            <div 
              key={i}
              className={`relative group ${plan.popular ? 'md:-mt-4 md:mb-4' : ''}`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                  <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary to-purple-600 shadow-lg shadow-primary/25">
                    <Sparkles className="h-4 w-4 text-white" />
                    <span className="text-white text-sm font-semibold">Más popular</span>
                  </div>
                </div>
              )}

              {/* Card */}
              <div className={`h-full p-8 rounded-2xl border transition-all duration-500 ${
                plan.popular 
                  ? "bg-gradient-to-b from-primary/10 to-purple-900/10 border-primary/50 shadow-2xl shadow-primary/10" 
                  : "bg-gray-900/50 border-gray-800 hover:border-gray-700"
              }`}>
                {/* Plan header */}
                <div className="text-center mb-8">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${plan.gradient} mb-4`}>
                    <span className="text-white font-bold text-lg">{plan.name.charAt(0)}</span>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <p className="text-gray-400 text-sm">{plan.description}</p>
                </div>

                {/* Price */}
                <div className="text-center mb-8">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-gray-400">$</span>
                    <span className={`text-5xl font-bold bg-gradient-to-r ${plan.gradient} bg-clip-text text-transparent`}>
                      {plan.price}
                    </span>
                  </div>
                  <span className="text-gray-500 text-sm">/mes · ARS</span>
                </div>

                {/* Features */}
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-3">
                      <div className={`flex-shrink-0 h-5 w-5 rounded-full bg-gradient-to-br ${plan.gradient} flex items-center justify-center mt-0.5`}>
                        <Check className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button 
                  asChild
                  className={`w-full py-6 text-lg font-semibold transition-all duration-300 ${
                    plan.popular 
                      ? "bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30" 
                      : "bg-white/10 hover:bg-white/20 border border-gray-700"
                  }`}
                  size="lg"
                >
                  <Link to="/login">
                    Comenzar gratis
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom text */}
        <div className="text-center mt-16">
          <p className="text-gray-500 mb-2">
            Todos los precios en pesos argentinos. Facturamos mensualmente.
          </p>
          <p className="text-gray-400">
            ¿Necesitas un plan personalizado?{" "}
            <a href="mailto:ventas@tuapp.com" className="text-primary hover:underline font-medium">
              Hablemos
            </a>
          </p>
        </div>
      </div>
    </section>
  );
};

export default Pricing;