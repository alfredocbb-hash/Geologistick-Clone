import { Package, Mail, Phone, MapPin, Linkedin, Twitter, Instagram } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="relative bg-[#0a0a0f] border-t border-gray-800">
      {/* Gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                <Package className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">LogiTrack</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              Plataforma líder en gestión de logística y envíos para empresas de courier en Argentina.
            </p>
            {/* Social links */}
            <div className="flex gap-3 pt-2">
              {[
                { icon: Twitter, href: "#" },
                { icon: Linkedin, href: "#" },
                { icon: Instagram, href: "#" },
              ].map((social, i) => (
                <a 
                  key={i}
                  href={social.href}
                  className="h-10 w-10 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors"
                >
                  <social.icon className="h-5 w-5 text-gray-400" />
                </a>
              ))}
            </div>
          </div>

          {/* Producto */}
          <div>
            <h4 className="text-white font-semibold mb-4">Producto</h4>
            <ul className="space-y-3">
              {["Características", "Precios", "Integraciones", "API", "Changelog"].map((item) => (
                <li key={item}>
                  <a href="#" className="text-gray-400 hover:text-primary transition-colors text-sm">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <h4 className="text-white font-semibold mb-4">Empresa</h4>
            <ul className="space-y-3">
              {["Sobre nosotros", "Blog", "Casos de éxito", "Partners", "Trabaja con nosotros"].map((item) => (
                <li key={item}>
                  <a href="#" className="text-gray-400 hover:text-primary transition-colors text-sm">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h4 className="text-white font-semibold mb-4">Contacto</h4>
            <ul className="space-y-4">
              <li className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <a href="mailto:soporte@logitrack.com" className="text-gray-400 hover:text-primary transition-colors text-sm">
                  soporte@logitrack.com
                </a>
              </li>
              <li className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <a href="tel:+5491155554444" className="text-gray-400 hover:text-primary transition-colors text-sm">
                  +54 11 5555-4444
                </a>
              </li>
              <li className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <span className="text-gray-400 text-sm">
                  Buenos Aires, Argentina
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} LogiTrack. Todos los derechos reservados.
          </p>
          <div className="flex gap-6">
            <Link to="/terms" className="text-gray-500 hover:text-gray-400 text-sm transition-colors">
              Términos de servicio
            </Link>
            <Link to="/privacy" className="text-gray-500 hover:text-gray-400 text-sm transition-colors">
              Privacidad
            </Link>
            <Link to="/cookies" className="text-gray-500 hover:text-gray-400 text-sm transition-colors">
              Cookies
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
