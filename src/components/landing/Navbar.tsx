import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Package, Menu, X } from "lucide-react";
import { Link } from "react-router-dom";

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Características", href: "#features" },
    { label: "Precios", href: "#pricing" },
    { label: "Tracking", href: "/tracking" },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled 
        ? "bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-gray-800/50 py-3" 
        : "bg-transparent py-5"
    }`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/25 group-hover:shadow-primary/40 transition-shadow">
              <Package className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">LogiTrack</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              link.href.startsWith("/") ? (
                <Link 
                  key={link.label}
                  to={link.href}
                  className="text-gray-400 hover:text-white transition-colors font-medium"
                >
                  {link.label}
                </Link>
              ) : (
                <a 
                  key={link.label}
                  href={link.href}
                  className="text-gray-400 hover:text-white transition-colors font-medium"
                >
                  {link.label}
                </a>
              )
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            <Button asChild variant="ghost" className="text-gray-300 hover:text-white hover:bg-white/10">
              <Link to="/login">Iniciar sesión</Link>
            </Button>
            <Button asChild className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25">
              <Link to="/login">Comenzar gratis</Link>
            </Button>
          </div>

          {/* Mobile menu button */}
          <button 
            className="md:hidden p-2 text-gray-400 hover:text-white"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-[#0a0a0f]/95 backdrop-blur-xl border-b border-gray-800 p-4 animate-fade-in">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                link.href.startsWith("/") ? (
                  <Link 
                    key={link.label}
                    to={link.href}
                    className="text-gray-300 hover:text-white transition-colors font-medium py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a 
                    key={link.label}
                    href={link.href}
                    className="text-gray-300 hover:text-white transition-colors font-medium py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                )
              ))}
              <div className="flex flex-col gap-3 pt-4 border-t border-gray-800">
                <Button asChild variant="outline" className="border-gray-700 text-white">
                  <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>Iniciar sesión</Link>
                </Button>
                <Button asChild className="bg-gradient-to-r from-primary to-purple-600">
                  <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>Comenzar gratis</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
