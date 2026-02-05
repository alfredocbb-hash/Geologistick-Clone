import { Button } from "@/components/ui/button";
import { ArrowRight, Package, Truck, MapPin, Zap, Shield, Globe } from "lucide-react";
import { Link } from "react-router-dom";
import { useLandingContent, defaultLandingContent } from "@/hooks/useLandingContent";

// Icon mapping for dynamic rendering
const iconMap: Record<string, React.ElementType> = {
  Package,
  Shield,
  Zap,
};

const Hero = () => {
  const { data: content } = useLandingContent();
  const hero = content?.hero || defaultLandingContent.hero!;

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#0a0a0f]">
      {/* Animated grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1a1a2e_1px,transparent_1px),linear-gradient(to_bottom,#1a1a2e_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
      
      {/* Glowing orbs - Geologistick colors */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[hsl(var(--geo-teal)/0.3)] rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[hsl(var(--geo-blue)/0.25)] rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 right-1/3 w-[300px] h-[300px] bg-[hsl(var(--geo-cyan)/0.2)] rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="container relative z-10 mx-auto px-4 py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Text content */}
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[hsl(var(--geo-teal)/0.5)] bg-[hsl(var(--geo-teal)/0.1)] backdrop-blur-sm">
              <div className="w-2 h-2 rounded-full bg-[hsl(var(--geo-cyan))] animate-pulse" />
              <span className="text-sm font-medium text-[hsl(var(--geo-teal))]">{hero.badge_text}</span>
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-bold leading-tight">
              <span className="text-white">{hero.title_line1}</span>
              <br />
              <span className="bg-gradient-to-r from-[hsl(var(--geo-teal))] via-[hsl(var(--geo-cyan))] to-[hsl(var(--geo-blue))] bg-clip-text text-transparent">
                {hero.title_line2}
              </span>
            </h1>
            
            <p className="text-xl text-gray-400 max-w-xl leading-relaxed">
              {hero.description}
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild size="lg" className="text-lg px-8 py-6 bg-gradient-to-r from-[hsl(var(--geo-teal))] to-[hsl(var(--geo-blue))] hover:from-[hsl(var(--geo-teal)/0.9)] hover:to-[hsl(var(--geo-blue)/0.9)] border-0 shadow-lg shadow-[hsl(var(--geo-teal)/0.25)]">
                <Link to="/login">
                  {hero.cta_primary}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6 border-[hsl(var(--geo-teal)/0.3)] bg-white/5 hover:bg-[hsl(var(--geo-teal)/0.1)] text-white backdrop-blur-sm">
                <a href="#features">{hero.cta_secondary}</a>
              </Button>
            </div>

            {/* Stats */}
            <div className="flex gap-8 pt-8">
              {hero.stats.map((stat, i) => {
                const StatIcon = iconMap[stat.icon] || Package;
                return (
                  <div key={i} className="group">
                    <div className="flex items-center gap-2 mb-1">
                      <StatIcon className="h-4 w-4 text-[hsl(var(--geo-teal))]" />
                      <p className="text-2xl lg:text-3xl font-bold text-white group-hover:text-[hsl(var(--geo-teal))] transition-colors">{stat.value}</p>
                    </div>
                    <p className="text-sm text-gray-500">{stat.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3D-like Dashboard Preview */}
          <div className="relative hidden lg:block perspective-1000">
            {/* Main card */}
            <div className="relative z-20 bg-gradient-to-br from-gray-900/90 to-gray-800/90 rounded-2xl border border-[hsl(var(--geo-teal)/0.3)] p-6 backdrop-blur-xl shadow-2xl transform hover:rotate-y-0 transition-transform duration-500" style={{ transform: 'rotateY(-5deg) rotateX(5deg)' }}>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-700/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[hsl(var(--geo-teal))] to-[hsl(var(--geo-blue))] flex items-center justify-center">
                    <Truck className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Centro de Control</p>
                    <p className="text-xs text-gray-500">Actualizado hace 2 seg</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 border border-green-500/30">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-400 text-sm font-medium">En vivo</span>
                </div>
              </div>
              
              {/* Live stats */}
              <div className="grid grid-cols-3 gap-4 py-4">
                {[
                  { label: "En ruta", value: "127", color: "text-cyan-400" },
                  { label: "Entregados", value: "843", color: "text-green-400" },
                  { label: "Pendientes", value: "56", color: "text-amber-400" },
                ].map((stat, i) => (
                  <div key={i} className="text-center p-3 rounded-lg bg-white/5">
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="text-xs text-gray-500">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Shipment cards */}
              <div className="space-y-3">
                {[
                  { id: "ENV-4521", status: "En camino", address: "Av. Corrientes 1234", progress: 65 },
                  { id: "ENV-4520", status: "Entregado", address: "Calle Florida 567", progress: 100 },
                  { id: "ENV-4519", status: "Recolectando", address: "Av. 9 de Julio 890", progress: 25 },
                ].map((shipment, i) => (
                  <div 
                    key={i} 
                    className="group p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-gray-700/50 hover:border-[hsl(var(--geo-teal)/0.5)] transition-all duration-300"
                  >
                  <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-[hsl(var(--geo-teal)/0.2)] flex items-center justify-center">
                          <MapPin className="h-4 w-4 text-[hsl(var(--geo-teal))]" />
                        </div>
                        <div>
                          <p className="font-medium text-white text-sm">{shipment.id}</p>
                          <p className="text-xs text-gray-500">{shipment.address}</p>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        shipment.status === "Entregado" 
                          ? "bg-green-500/20 text-green-400 border border-green-500/30"
                          : shipment.status === "En camino"
                          ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                          : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      }`}>
                        {shipment.status}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${
                          shipment.status === "Entregado" ? "bg-green-500" 
                          : shipment.status === "En camino" ? "bg-cyan-500"
                          : "bg-amber-500"
                        }`}
                        style={{ width: `${shipment.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Floating elements */}
            <div className="absolute -top-6 -right-6 p-4 rounded-xl bg-gradient-to-br from-[hsl(var(--geo-blue))] to-[hsl(var(--geo-dark))] border border-[hsl(var(--geo-blue)/0.5)] backdrop-blur-sm shadow-xl animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <Globe className="h-6 w-6 text-white" />
            </div>
            <div className="absolute -bottom-4 -left-4 px-4 py-3 rounded-xl bg-gradient-to-br from-[hsl(var(--geo-teal))] to-[hsl(var(--geo-cyan))] border border-[hsl(var(--geo-teal)/0.5)] backdrop-blur-sm shadow-xl animate-fade-in" style={{ animationDelay: '0.5s' }}>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-white" />
                <span className="text-white font-medium text-sm">IA Activa</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default Hero;
