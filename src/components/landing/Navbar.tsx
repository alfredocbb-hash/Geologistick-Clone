import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LanguageSelector } from "@/components/i18n/LanguageSelector";
import geologistickLogo from "@/assets/geologistick-logo.png";

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Funcionalidades", href: "#features" },
    { label: "Circuito", href: "#circuit" },
    { label: "Precios", href: "#pricing" },
    { label: "Tracking", href: "/tracking" },
    { label: "Contacto", href: "#contact" },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      isScrolled 
        ? "bg-background/80 dark:bg-[#050507]/80 backdrop-blur-2xl border-b border-border dark:border-white/5 py-4" 
        : "bg-transparent py-6"
    }`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <img 
              src={geologistickLogo} 
              alt="Geologistick" 
              className="h-10 w-10 rounded-lg object-contain transition-transform duration-300 group-hover:scale-105"
            />
            <span className="text-xl font-bold text-foreground dark:text-white tracking-tight">Geologistick</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-10">
            {navLinks.map((link) => (
              link.href.startsWith("/") ? (
                <Link 
                  key={link.label}
                  to={link.href}
                  className="text-muted-foreground dark:text-gray-400 hover:text-foreground dark:hover:text-white transition-colors font-medium text-sm"
                >
                  {link.label}
                </Link>
              ) : (
                <a 
                  key={link.label}
                  href={link.href}
                  className="text-muted-foreground dark:text-gray-400 hover:text-foreground dark:hover:text-white transition-colors font-medium text-sm"
                >
                  {link.label}
                </a>
              )
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <Button asChild variant="ghost" className="text-muted-foreground dark:text-gray-400 hover:text-foreground dark:hover:text-white hover:bg-muted dark:hover:bg-white/5 rounded-full px-6">
              <Link to="/login">Iniciar sesión</Link>
            </Button>
            <Button asChild className="bg-foreground dark:bg-white text-background dark:text-black hover:bg-foreground/90 dark:hover:bg-gray-100 rounded-full px-6 font-medium">
              <Link to="/login">
                Comenzar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* Mobile menu button */}
          <button 
            className="md:hidden p-2 text-muted-foreground dark:text-gray-400 hover:text-foreground dark:hover:text-white transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-background/95 dark:bg-[#050507]/95 backdrop-blur-2xl border-b border-border dark:border-white/5 p-6 animate-fade-in">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                link.href.startsWith("/") ? (
                  <Link 
                    key={link.label}
                    to={link.href}
                    className="text-muted-foreground dark:text-gray-300 hover:text-foreground dark:hover:text-white transition-colors font-medium py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a 
                    key={link.label}
                    href={link.href}
                    className="text-muted-foreground dark:text-gray-300 hover:text-foreground dark:hover:text-white transition-colors font-medium py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </a>
                )
              ))}
              <div className="flex flex-col gap-3 pt-4 border-t border-border dark:border-white/5">
                <div className="flex items-center justify-center py-2">
                  <ThemeToggle />
                </div>
                <Button asChild variant="ghost" className="justify-center text-foreground dark:text-white hover:bg-muted dark:hover:bg-white/5">
                  <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>Iniciar sesión</Link>
                </Button>
                <Button asChild className="bg-foreground dark:bg-white text-background dark:text-black hover:bg-foreground/90 dark:hover:bg-gray-100 justify-center">
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
