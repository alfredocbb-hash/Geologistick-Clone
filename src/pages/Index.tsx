import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Clients from "@/components/landing/Clients";
import QuienesSomos from "@/components/landing/QuienesSomos";
import Features from "@/components/landing/Features";
import Circuito from "@/components/landing/Circuito";
import StatsCounter from "@/components/landing/StatsCounter";
import Pricing from "@/components/landing/Pricing";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <Navbar />
      <Hero />
      <Clients />
      <QuienesSomos />
      <Features />
      <Circuito />
      <StatsCounter />
      <Pricing />
      <CTASection />
      <Footer />
    </div>
  );
};

export default Index;
