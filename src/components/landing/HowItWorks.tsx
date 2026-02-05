import { UserPlus, Settings, Truck, ArrowRight } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Registrate gratis",
    description: "Crea tu cuenta en menos de 2 minutos. Sin tarjeta de crédito, sin compromisos.",
    icon: UserPlus,
    color: "from-[hsl(var(--geo-teal))] to-[hsl(var(--geo-cyan))]",
    borderColor: "border-[hsl(var(--geo-teal)/0.5)]",
    iconBg: "bg-[hsl(var(--geo-teal)/0.2)]",
    iconColor: "text-[hsl(var(--geo-teal))]"
  },
  {
    number: "02",
    title: "Configura tu operación",
    description: "Añade sucursales, choferes, tarifas y personaliza tu sistema a medida.",
    icon: Settings,
    color: "from-[hsl(var(--geo-blue))] to-[hsl(var(--geo-teal))]",
    borderColor: "border-[hsl(var(--geo-blue)/0.5)]",
    iconBg: "bg-[hsl(var(--geo-blue)/0.2)]",
    iconColor: "text-[hsl(var(--geo-blue))]"
  },
  {
    number: "03",
    title: "Opera y crece",
    description: "Gestiona envíos, optimiza rutas con IA y escala tu negocio sin límites.",
    icon: Truck,
    color: "from-[hsl(var(--geo-dark))] to-[hsl(var(--geo-blue))]",
    borderColor: "border-[hsl(var(--geo-dark)/0.5)]",
    iconBg: "bg-[hsl(var(--geo-dark)/0.3)]",
    iconColor: "text-white"
  }
];

const HowItWorks = () => {
  return (
    <section className="relative py-24 bg-gradient-to-b from-[#0a0a0f] via-[hsl(var(--geo-dark)/0.1)] to-[#0a0a0f]">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1a1a2e_1px,transparent_1px),linear-gradient(to_bottom,#1a1a2e_1px,transparent_1px)] bg-[size:6rem_6rem] opacity-30" />
      
      <div className="container relative z-10 mx-auto px-4">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-2 rounded-full bg-[hsl(var(--geo-teal)/0.1)] border border-[hsl(var(--geo-teal)/0.3)] text-[hsl(var(--geo-teal))] text-sm font-medium mb-4">
            Proceso simple
          </span>
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-4">
            ¿Cómo funciona?
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            En solo 3 pasos tendrás tu operación logística funcionando al 100%
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, index) => (
            <div key={step.number} className="relative group">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-16 left-[60%] w-[80%] h-px">
                  <div className="w-full h-full bg-gradient-to-r from-gray-700 to-transparent" />
                  <ArrowRight className="absolute -right-2 -top-2 h-4 w-4 text-gray-600" />
                </div>
              )}

              <div className={`relative p-8 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border ${step.borderColor} hover:border-[hsl(var(--geo-teal))] transition-all duration-300 group-hover:-translate-y-2`}>
                {/* Step number */}
                <div className="absolute -top-4 -left-2 px-3 py-1 rounded-lg bg-gradient-to-r ${step.color} text-white font-bold text-sm">
                  {step.number}
                </div>

                {/* Icon */}
                <div className={`w-16 h-16 rounded-2xl ${step.iconBg} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <step.icon className={`h-8 w-8 ${step.iconColor}`} />
                </div>

                <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                <p className="text-gray-400 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
