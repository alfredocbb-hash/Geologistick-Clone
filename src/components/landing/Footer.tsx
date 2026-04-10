import { Link } from "react-router-dom";
import { MessageCircle, Mail, Phone, MapPin } from "lucide-react";
import geologistickLogo from "@/assets/geologistick-logo.png";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const whatsappUrl = "https://wa.me/5491112345678?text=Hola,%20me%20interesa%20conocer%20más%20sobre%20Geologistick";

  const links = {
    producto: [
      { label: "Funcionalidades", href: "#features" },
      { label: "Circuito operativo", href: "#circuit" },
      { label: "Precios", href: "#pricing" },
      { label: "Tracking", href: "/tracking" },
    ],
    legal: [
      { label: "Términos", href: "/terms" },
      { label: "Privacidad", href: "/privacy" },
      { label: "Cookies", href: "/cookies" },
    ],
    contacto: [
      { label: "soporte@geologistick.com", href: "mailto:soporte@geologistick.com", icon: Mail },
      { label: "WhatsApp", href: whatsappUrl, icon: MessageCircle },
    ],
  };

  return (
    <footer id="contact" className="relative bg-background dark:bg-[#050507] border-t border-border dark:border-white/5">
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
            <p className="text-muted-foreground dark:text-gray-500 text-sm leading-relaxed max-w-xs mb-6">
              La plataforma de gestión logística más completa de Argentina. Optimiza tus entregas con tecnología de punta.
            </p>
            {/* Contact info */}
            <div className="space-y-3">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground dark:text-gray-500 hover:text-foreground dark:hover:text-white transition-colors">
                <MessageCircle className="h-4 w-4 text-green-500" />
                <span>WhatsApp</span>
              </a>
              <a href="mailto:soporte@geologistick.com" className="flex items-center gap-2 text-sm text-muted-foreground dark:text-gray-500 hover:text-foreground dark:hover:text-white transition-colors">
                <Mail className="h-4 w-4" />
                <span>soporte@geologistick.com</span>
              </a>
            </div>
          </div>

          {/* Producto */}
          <div>
            <h4 className="text-foreground dark:text-white font-semibold mb-4 text-sm uppercase tracking-wider">Producto</h4>
            <ul className="space-y-3">
              {links.producto.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith("/") ? (
                    <Link to={link.href} className="text-muted-foreground dark:text-gray-500 hover:text-foreground dark:hover:text-white transition-colors text-sm">
                      {link.label}
                    </Link>
                  ) : (
                    <a href={link.href} className="text-muted-foreground dark:text-gray-500 hover:text-foreground dark:hover:text-white transition-colors text-sm">
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
                  <Link to={link.href} className="text-muted-foreground dark:text-gray-500 hover:text-foreground dark:hover:text-white transition-colors text-sm">
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
              <li>
                <Link to="/support" className="text-muted-foreground dark:text-gray-500 hover:text-foreground dark:hover:text-white transition-colors text-sm">
                  Centro de Ayuda
                </Link>
              </li>
              {links.contacto.map((link) => (
                <li key={link.label}>
                  <a href={link.href} target={link.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="text-muted-foreground dark:text-gray-500 hover:text-foreground dark:hover:text-white transition-colors text-sm">
                    {link.label}
                  </a>
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

      {/* Floating WhatsApp button */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-lg shadow-green-500/30 transition-all duration-300 hover:scale-110"
        aria-label="Contactar por WhatsApp"
      >
        <MessageCircle className="h-7 w-7 text-white" />
      </a>
    </footer>
  );
};

export default Footer;
