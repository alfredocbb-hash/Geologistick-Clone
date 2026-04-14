import { 
  FileText, 
  MapPin, 
  Calculator, 
  ShoppingBag, 
  QrCode, 
  Tag,
  BarChart3,
  Smartphone
} from "lucide-react";
import { useLandingContent, defaultLandingContent } from "@/hooks/useLandingContent";
import { useTranslation } from "react-i18next";

const featureIcons = [FileText, MapPin, Calculator, ShoppingBag, QrCode, Tag, BarChart3, Smartphone];

const Features = () => {
  const { data: content } = useLandingContent();
  const featuresContent = content?.features || defaultLandingContent.features!;
  const { t } = useTranslation('landing');

  const features = featureIcons.map((icon, i) => ({
    icon,
    title: t(`features.f${i + 1}Title`),
    description: t(`features.f${i + 1}Desc`),
  }));

  return (
    <section id="features" className="relative py-28 overflow-hidden bg-background dark:bg-[#050507]">
      <div className="container relative z-10 mx-auto px-4">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-20">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground dark:text-white mb-6 tracking-tight">
            {t('features.title')}
            <span className="bg-gradient-to-r from-[hsl(var(--geo-teal))] to-[hsl(var(--geo-cyan))] bg-clip-text text-transparent">{t('features.titleHighlight')}</span>
          </h2>
          <p className="text-lg text-muted-foreground dark:text-gray-400">
            {featuresContent.subtitle}
          </p>
        </div>

        {/* Feature cards - 2 columns, large cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {features.map((feature, i) => (
            <div 
              key={i}
              className="group relative p-8 rounded-2xl bg-card dark:bg-white/[0.02] border border-border dark:border-white/5 hover:border-[hsl(var(--geo-teal)/0.3)] transition-all duration-300 hover:shadow-lg"
            >
              <div className="flex gap-5">
                <div className="shrink-0">
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[hsl(var(--geo-teal)/0.15)] to-[hsl(var(--geo-blue)/0.1)] flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <feature.icon className="h-7 w-7 text-[hsl(var(--geo-teal))]" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground dark:text-white mb-2 group-hover:text-[hsl(var(--geo-teal))] transition-colors duration-300">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground dark:text-gray-500 leading-relaxed text-sm">
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
