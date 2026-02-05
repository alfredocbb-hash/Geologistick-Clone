import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Clients from "@/components/landing/Clients";
import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import Pricing from "@/components/landing/Pricing";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <Navbar />
      <Hero />
      <Clients />
      <HowItWorks />
      <Features />
      <Pricing />
      <CTASection />
      <Footer />
    </div>
  );
};

export default Index;
