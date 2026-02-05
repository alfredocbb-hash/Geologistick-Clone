import { Button } from "@/components/ui/button";
import { ArrowRight, Truck, Sparkles, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { useLandingContent, defaultLandingContent } from "@/hooks/useLandingContent";
import { useState } from "react";

const Hero = () => {
  const { data: content } = useLandingContent();
  const hero = content?.hero || defaultLandingContent.hero!;
  const [isHovered, setIsHovered] = useState(false);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#050507]">
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0">
        {/* Primary glow */}
        <div 
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] rounded-full blur-[150px] animate-pulse"
          style={{ 
            background: 'radial-gradient(ellipse, hsl(174 50% 50% / 0.15) 0%, transparent 70%)',
            animationDuration: '4s'
          }}
        />
        {/* Secondary glow */}
        <div 
          className="absolute bottom-1/4 left-1/4 w-[600px] h-[400px] rounded-full blur-[120px] animate-pulse"
          style={{ 
            background: 'radial-gradient(ellipse, hsl(207 50% 35% / 0.1) 0%, transparent 70%)',
            animationDuration: '6s',
            animationDelay: '2s'
          }}
        />
        {/* Accent glow */}
        <div 
          className="absolute top-1/4 right-1/4 w-[400px] h-[300px] rounded-full blur-[100px] animate-pulse"
          style={{ 
            background: 'radial-gradient(ellipse, hsl(187 70% 45% / 0.08) 0%, transparent 70%)',
            animationDuration: '5s',
            animationDelay: '1s'
          }}
        />
      </div>

      {/* Subtle grid overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(90deg, white 1px, transparent 1px),
            linear-gradient(180deg, white 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px'
        }}
      />

      {/* Noise texture */}
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
      }} />

      <div className="container relative z-10 mx-auto px-4 py-32">
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div 
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[hsl(var(--geo-teal)/0.3)] bg-[hsl(var(--geo-teal)/0.05)] backdrop-blur-xl mb-10 animate-fade-in"
            style={{ animationDelay: '0.1s' }}
          >
            <Sparkles className="h-4 w-4 text-[hsl(var(--geo-teal))]" />
            <span className="text-sm font-medium text-[hsl(var(--geo-teal))]">{hero.badge_text}</span>
          </div>
          
          {/* Main headline */}
          <h1 
            className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 animate-fade-in"
            style={{ animationDelay: '0.2s' }}
          >
            <span className="block text-white mb-2">{hero.title_line1}</span>
            <span className="block bg-gradient-to-r from-[hsl(var(--geo-teal))] via-[hsl(var(--geo-cyan))] to-[hsl(var(--geo-blue))] bg-clip-text text-transparent">
              {hero.title_line2}
            </span>
          </h1>
          
          {/* Subtitle */}
          <p 
            className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto leading-relaxed mb-12 animate-fade-in"
            style={{ animationDelay: '0.3s' }}
          >
            {hero.description}
          </p>

          {/* CTAs */}
          <div 
            className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-20 animate-fade-in"
            style={{ animationDelay: '0.4s' }}
          >
            <Button 
              asChild 
              size="lg" 
              className="text-lg px-10 py-7 bg-white text-black hover:bg-gray-100 rounded-full font-semibold transition-all duration-300 hover:scale-105 shadow-2xl shadow-white/10"
            >
              <Link to="/login">
                {hero.cta_primary}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button 
              asChild 
              variant="ghost" 
              size="lg" 
              className="text-lg px-10 py-7 text-gray-300 hover:text-white hover:bg-white/5 rounded-full font-medium group"
            >
              <a href="#features">
                <Play className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                {hero.cta_secondary}
              </a>
            </Button>
          </div>

          {/* Stats row */}
          <div 
            className="flex flex-wrap items-center justify-center gap-12 lg:gap-20 animate-fade-in"
            style={{ animationDelay: '0.5s' }}
          >
            {hero.stats.map((stat, i) => (
              <div 
                key={i} 
                className="group cursor-default"
              >
                <div className="text-4xl lg:text-5xl font-bold text-white mb-2 transition-all duration-300 group-hover:text-[hsl(var(--geo-teal))]">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-500 uppercase tracking-wider">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Floating dashboard preview */}
        <div 
          className="relative max-w-4xl mx-auto mt-24 animate-fade-in"
          style={{ animationDelay: '0.6s' }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Glow effect behind card */}
          <div 
            className={`absolute -inset-4 rounded-3xl transition-all duration-700 ${isHovered ? 'opacity-100' : 'opacity-50'}`}
            style={{
              background: 'linear-gradient(135deg, hsl(174 50% 50% / 0.2), hsl(207 50% 35% / 0.1))',
              filter: 'blur(60px)'
            }}
          />
          
          {/* Main preview card */}
          <div 
            className={`relative bg-gray-900/80 backdrop-blur-xl rounded-2xl border border-gray-800/50 p-6 transition-all duration-500 ${isHovered ? 'border-[hsl(var(--geo-teal)/0.5)] scale-[1.01]' : ''}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-5 border-b border-gray-800/50">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[hsl(var(--geo-teal))] to-[hsl(var(--geo-blue))] flex items-center justify-center">
                  <Truck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-lg">Centro de Control</h3>
                  <p className="text-xs text-gray-500">Actualizado en tiempo real</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-400 text-sm font-medium">En vivo</span>
              </div>
            </div>
            
            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-4 py-6">
              {[
                { label: "En Ruta", value: "127", trend: "+12%", color: "text-[hsl(var(--geo-cyan))]" },
                { label: "Entregados", value: "843", trend: "+8%", color: "text-green-400" },
                { label: "Pendientes", value: "56", trend: "-5%", color: "text-amber-400" },
              ].map((stat, i) => (
                <div 
                  key={i} 
                  className="text-center p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors"
                >
                  <p className={`text-3xl font-bold ${stat.color} mb-1`}>{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Activity items */}
            <div className="space-y-3">
              {[
                { id: "ENV-4521", status: "En camino", location: "Av. Corrientes 1234", time: "hace 2 min" },
                { id: "ENV-4520", status: "Entregado", location: "Calle Florida 567", time: "hace 8 min" },
                { id: "ENV-4519", status: "Recolectando", location: "Av. 9 de Julio 890", time: "hace 15 min" },
              ].map((item, i) => (
                <div 
                  key={i}
                  className="group flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[hsl(var(--geo-teal)/0.3)] hover:bg-white/[0.04] transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-[hsl(var(--geo-teal)/0.1)] flex items-center justify-center">
                      <Truck className="h-5 w-5 text-[hsl(var(--geo-teal))]" />
                    </div>
                    <div>
                      <p className="font-medium text-white text-sm">{item.id}</p>
                      <p className="text-xs text-gray-500">{item.location}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      item.status === "Entregado" 
                        ? "bg-green-500/10 text-green-400"
                        : item.status === "En camino"
                        ? "bg-[hsl(var(--geo-cyan)/0.1)] text-[hsl(var(--geo-cyan))]"
                        : "bg-amber-500/10 text-amber-400"
                    }`}>
                      {item.status}
                    </span>
                    <p className="text-xs text-gray-600 mt-1">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#050507] to-transparent" />
    </section>
  );
};

export default Hero;
