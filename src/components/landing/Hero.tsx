import { Button } from "@/components/ui/button";
import { ArrowRight, Search, MessageCircle, Package, MapPin, Shield } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useLandingContent, defaultLandingContent } from "@/hooks/useLandingContent";
import { useState } from "react";

const Hero = () => {
  const { data: content } = useLandingContent();
  const hero = content?.hero || defaultLandingContent.hero!;
  const [trackingCode, setTrackingCode] = useState("");
  const navigate = useNavigate();

  const handleTracking = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingCode.trim()) {
      navigate(`/tracking?code=${trackingCode.trim()}`);
    }
  };

  const whatsappNumber = "5491151767139";
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=Hola,%20me%20interesa%20conocer%20más%20sobre%20Geologistick`;

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-b from-background to-muted dark:bg-[#050507]">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div
          className="absolute top-1/3 left-1/4 w-[800px] h-[500px] rounded-full blur-[150px] opacity-20 dark:opacity-40"
          style={{ background: "radial-gradient(ellipse, hsl(174 50% 50% / 0.2) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-[600px] h-[400px] rounded-full blur-[120px] opacity-20 dark:opacity-30"
          style={{ background: "radial-gradient(ellipse, hsl(207 50% 35% / 0.15) 0%, transparent 70%)" }}
        />
      </div>

      <div className="container relative z-10 mx-auto px-4 pt-32 pb-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Content */}
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[hsl(var(--geo-teal)/0.3)] bg-[hsl(var(--geo-teal)/0.05)] backdrop-blur-xl animate-fade-in">
              <Package className="h-4 w-4 text-[hsl(var(--geo-teal))]" />
              <span className="text-sm font-medium text-[hsl(var(--geo-teal))]">{hero.badge_text}</span>
            </div>

            {/* Headline */}
            <h1
              className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight animate-fade-in"
              style={{ animationDelay: "0.1s" }}
            >
              <span className="block text-foreground dark:text-white mb-2">Software de</span>
              <span className="block bg-gradient-to-r from-[hsl(var(--geo-teal))] via-[hsl(var(--geo-cyan))] to-[hsl(var(--geo-blue))] bg-clip-text text-secondary-foreground">
                logística inteligente
              </span>
            </h1>

            {/* Description */}
            <p
              className="text-lg md:text-xl text-muted-foreground dark:text-gray-400 max-w-lg leading-relaxed animate-fade-in"
              style={{ animationDelay: "0.2s" }}
            >
              {hero.description}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center gap-4 animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <Button
                asChild
                size="lg"
                className="text-lg px-8 py-6 bg-foreground dark:bg-white text-background dark:text-black hover:bg-foreground/90 dark:hover:bg-gray-100 rounded-full font-semibold transition-all duration-300 hover:scale-105"
              >
                <Link to="/login">
                  {hero.cta_primary}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="text-lg px-8 py-6 bg-green-600 hover:bg-green-700 text-white rounded-full font-semibold transition-all duration-300 hover:scale-105"
              >
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-5 w-5" />
                  WhatsApp
                </a>
              </Button>
            </div>

            {/* Trust indicators */}
            <div
              className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground dark:text-gray-500 animate-fade-in"
              style={{ animationDelay: "0.4s" }}
            >
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                <span>14 días gratis</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                <span>Sin tarjeta</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                <span>Soporte incluido</span>
              </div>
            </div>
          </div>

          {/* Right: Tracking + Visual */}
          <div className="space-y-8 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            {/* Tracking card */}
            <div className="bg-card dark:bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-border dark:border-white/10 p-8 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-[hsl(var(--geo-teal)/0.1)] flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-[hsl(var(--geo-teal))]" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground dark:text-white">Seguí tu envío</h3>
                  <p className="text-sm text-muted-foreground dark:text-gray-500">Ingresá el código de tracking</p>
                </div>
              </div>
              <form onSubmit={handleTracking} className="flex gap-3">
                <input
                  type="text"
                  placeholder="Ej: ENV-A3K9P2"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  className="flex-1 h-12 rounded-xl border border-input bg-background px-4 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Button
                  type="submit"
                  size="lg"
                  className="h-12 px-6 rounded-xl bg-[hsl(var(--geo-teal))] hover:bg-[hsl(var(--geo-teal)/0.9)] text-white"
                >
                  <Search className="h-5 w-5" />
                </Button>
              </form>
            </div>

            {/* Mini feature cards */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: "📦", title: "Gestión de envíos", desc: "Crea, rastrea y entrega" },
                { icon: "🗺️", title: "GPS en tiempo real", desc: "Seguí a tus choferes" },
                { icon: "📊", title: "Liquidaciones", desc: "Cálculo automático" },
                { icon: "🔗", title: "Integraciones", desc: "ML, Tiendanube, API" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="group p-5 rounded-xl bg-card dark:bg-white/[0.02] border border-border dark:border-white/5 hover:border-[hsl(var(--geo-teal)/0.3)] transition-all duration-300"
                >
                  <div className="text-2xl mb-3">{item.icon}</div>
                  <h4 className="font-semibold text-foreground dark:text-white text-sm mb-1 group-hover:text-[hsl(var(--geo-teal))] transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-xs text-muted-foreground dark:text-gray-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-muted dark:from-[#050507] to-transparent" />
    </section>
  );
};

export default Hero;
