import { Package, Mail, Phone, MapPin, Linkedin, Twitter, Instagram, Facebook } from "lucide-react";
import { Link } from "react-router-dom";
import { useTenant } from "@/hooks/useTenant";

const Footer = () => {
  const { branding } = useTenant();

  // Get values from branding or use defaults
  const appName = branding?.nombre_app || "LogiTrack";
  const description = branding?.company_description || "Plataforma líder en gestión de logística y envíos para empresas de courier en Argentina.";
  const supportEmail = branding?.support_email || "soporte@logitrack.com";
  const supportPhone = branding?.support_phone || "+54 11 5555-4444";
  const address = branding?.company_address;
  const city = branding?.company_city || "Buenos Aires";
  const country = branding?.company_country || "Argentina";
  const footerText = branding?.footer_text;

  // Social links - only show if configured
  const socialLinks = [
    { icon: Twitter, href: branding?.social_twitter, label: "Twitter" },
    { icon: Linkedin, href: branding?.social_linkedin, label: "LinkedIn" },
    { icon: Instagram, href: branding?.social_instagram, label: "Instagram" },
    { icon: Facebook, href: branding?.social_facebook, label: "Facebook" },
  ].filter(social => social.href);

  // Build location string
  const location = [address, city, country].filter(Boolean).join(", ") || `${city}, ${country}`;

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
              <span className="text-xl font-bold text-white">{appName}</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              {description}
            </p>
            {/* Social links - only show if there are any configured */}
            {socialLinks.length > 0 && (
              <div className="flex gap-3 pt-2">
                {socialLinks.map((social, i) => (
                  <a 
                    key={i}
                    href={social.href!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 w-10 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors"
                    aria-label={social.label}
                  >
                    <social.icon className="h-5 w-5 text-gray-400" />
                  </a>
                ))}
              </div>
            )}
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
                <a href={`mailto:${supportEmail}`} className="text-gray-400 hover:text-primary transition-colors text-sm">
                  {supportEmail}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <a href={`tel:${supportPhone.replace(/\s/g, '')}`} className="text-gray-400 hover:text-primary transition-colors text-sm">
                  {supportPhone}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <span className="text-gray-400 text-sm">
                  {location}
                </span>
              </li>
              {branding?.social_whatsapp && (
                <li className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </div>
                  <a 
                    href={`https://wa.me/${branding.social_whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-primary transition-colors text-sm"
                  >
                    {branding.social_whatsapp}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm">
            {footerText || `© ${new Date().getFullYear()} ${appName}. Todos los derechos reservados.`}
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
