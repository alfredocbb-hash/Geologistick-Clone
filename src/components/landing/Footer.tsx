import { Link } from "react-router-dom";
import geologistickLogo from "@/assets/geologistick-logo.png";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const links = {
    producto: [
      { label: "Características", href: "#features" },
      { label: "Precios", href: "#pricing" },
      { label: "Tracking", href: "/tracking" },
    ],
    legal: [
      { label: "Términos", href: "/terms" },
      { label: "Privacidad", href: "/privacy" },
      { label: "Cookies", href: "/cookies" },
    ],
    soporte: [
      { label: "Centro de Ayuda", href: "/support" },
      { label: "Contacto", href: "mailto:soporte@geologistick.com" },
    ],
  };

  return (
    <footer className="relative bg-background dark:bg-[#050507] border-t border-border dark:border-white/5">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-3 mb-6">
              <img 
                src={geologistickLogo} 
                alt="Geologistick" 
                className="h-10 w-10 rounded-lg object-contain"
              />
              <span className="text-xl font-bold text-foreground dark:text-white tracking-tight">Geologistick</span>
            </Link>
            <p className="text-muted-foreground dark:text-gray-500 text-sm leading-relaxed max-w-xs">
              La plataforma de gestión logística más completa de Argentina. Optimiza tus entregas con tecnología de punta.
            </p>
          </div>

          {/* Producto */}
          <div>
            <h4 className="text-foreground dark:text-white font-semibold mb-4 text-sm uppercase tracking-wider">Producto</h4>
            <ul className="space-y-3">
              {links.producto.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith("/") ? (
                    <Link 
                      to={link.href}
                      className="text-muted-foreground dark:text-gray-500 hover:text-foreground dark:hover:text-white transition-colors text-sm"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a 
                      href={link.href}
                      className="text-muted-foreground dark:text-gray-500 hover:text-foreground dark:hover:text-white transition-colors text-sm"
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-foreground dark:text-white font-semibold mb-4 text-sm uppercase tracking-wider">Legal</h4>
            <ul className="space-y-3">
              {links.legal.map((link) => (
                <li key={link.label}>
                  <Link 
                    to={link.href}
                    className="text-muted-foreground dark:text-gray-500 hover:text-foreground dark:hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Soporte */}
          <div>
            <h4 className="text-foreground dark:text-white font-semibold mb-4 text-sm uppercase tracking-wider">Soporte</h4>
            <ul className="space-y-3">
              {links.soporte.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith("/") ? (
                    <Link 
                      to={link.href}
                      className="text-muted-foreground dark:text-gray-500 hover:text-foreground dark:hover:text-white transition-colors text-sm"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a 
                      href={link.href}
                      className="text-muted-foreground dark:text-gray-500 hover:text-foreground dark:hover:text-white transition-colors text-sm"
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-border dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-muted-foreground/70 dark:text-gray-600 text-sm">
            © {currentYear} Geologistick. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-2 text-muted-foreground/70 dark:text-gray-600 text-sm">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span>Todos los sistemas operativos</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
