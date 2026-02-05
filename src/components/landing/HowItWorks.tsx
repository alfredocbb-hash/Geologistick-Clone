import { UserPlus, Settings, Truck, ArrowRight } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    number: "01",
    title: "Regístrate",
    description: "Crea tu cuenta en menos de 2 minutos. Sin tarjeta de crédito.",
  },
  {
    icon: Settings,
    number: "02", 
    title: "Configura",
    description: "Añade sucursales, choferes, vehículos y define tus tarifas.",
  },
  {
    icon: Truck,
    number: "03",
    title: "Opera",
    description: "Gestiona envíos, rastrea en tiempo real y cobra automáticamente.",
  }
];

const HowItWorks = () => {
  return (
    <section className="relative py-32 overflow-hidden bg-[#050507]">
      {/* Gradient accent */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[hsl(var(--geo-blue)/0.05)] rounded-full blur-[150px]" />

      <div className="container relative z-10 mx-auto px-4">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-20">
          <h2 className="text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
            Comienza en
            <span className="bg-gradient-to-r from-[hsl(var(--geo-teal))] to-[hsl(var(--geo-cyan))] bg-clip-text text-transparent"> minutos</span>
          </h2>
          <p className="text-xl text-gray-400">
            Tres simples pasos para transformar tu operación logística
          </p>
        </div>

        {/* Steps */}
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-24 left-[20%] right-[20%] h-px bg-gradient-to-r from-[hsl(var(--geo-teal)/0.3)] via-[hsl(var(--geo-cyan)/0.3)] to-[hsl(var(--geo-blue)/0.3)]" />
            
            {steps.map((step, i) => (
              <div 
                key={i}
                className="relative group"
              >
                {/* Card */}
                <div className="relative p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-[hsl(var(--geo-teal)/0.3)] transition-all duration-500 hover:bg-white/[0.04] text-center">
                  {/* Step number badge */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[hsl(var(--geo-teal)/0.1)] border border-[hsl(var(--geo-teal)/0.3)]">
                    <span className="text-sm font-mono text-[hsl(var(--geo-teal))]">{step.number}</span>
                  </div>
                  
                  {/* Icon */}
                  <div className="mx-auto mb-6 mt-4 h-16 w-16 rounded-2xl bg-gradient-to-br from-[hsl(var(--geo-teal)/0.15)] to-[hsl(var(--geo-blue)/0.1)] flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <step.icon className="h-8 w-8 text-[hsl(var(--geo-teal))]" />
                  </div>
                  
                  {/* Content */}
                  <h3 className="text-2xl font-semibold text-white mb-3">
                    {step.title}
                  </h3>
                  <p className="text-gray-500 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Arrow connector (mobile) */}
                {i < steps.length - 1 && (
                  <div className="md:hidden flex justify-center my-4">
                    <ArrowRight className="h-6 w-6 text-gray-700 rotate-90" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
