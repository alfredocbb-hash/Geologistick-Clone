import { Target, Eye, Truck } from "lucide-react";
import { useLandingContent, defaultLandingContent } from "@/hooks/useLandingContent";
import { useTranslation } from "react-i18next";

const QuienesSomos = () => {
  const { data: content } = useLandingContent();
  const about = content?.about || defaultLandingContent.about!;
  const { t } = useTranslation('landing');

  return (
    <section id="about" className="relative py-28 overflow-hidden bg-background dark:bg-[#050507]">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground dark:text-white mb-6 tracking-tight">
            {about.title}
          </h2>
          <p className="text-lg text-muted-foreground dark:text-gray-400 leading-relaxed">
            {about.description}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="p-8 rounded-2xl bg-card dark:bg-white/[0.02] border border-border dark:border-white/5 hover:border-[hsl(var(--geo-teal)/0.3)] transition-all duration-300 group">
            <div className="h-14 w-14 rounded-xl bg-[hsl(var(--geo-teal)/0.1)] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Truck className="h-7 w-7 text-[hsl(var(--geo-teal))]" />
            </div>
            <h3 className="text-xl font-semibold text-foreground dark:text-white mb-3">{t('about.whoWeAre')}</h3>
            <p className="text-muted-foreground dark:text-gray-400 leading-relaxed">
              {about.who_we_are}
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-card dark:bg-white/[0.02] border border-border dark:border-white/5 hover:border-[hsl(var(--geo-teal)/0.3)] transition-all duration-300 group">
            <div className="h-14 w-14 rounded-xl bg-[hsl(var(--geo-cyan)/0.1)] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Target className="h-7 w-7 text-[hsl(var(--geo-cyan))]" />
            </div>
            <h3 className="text-xl font-semibold text-foreground dark:text-white mb-3">{t('about.ourMission')}</h3>
            <p className="text-muted-foreground dark:text-gray-400 leading-relaxed">
              {about.mission}
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-card dark:bg-white/[0.02] border border-border dark:border-white/5 hover:border-[hsl(var(--geo-teal)/0.3)] transition-all duration-300 group">
            <div className="h-14 w-14 rounded-xl bg-[hsl(var(--geo-blue)/0.1)] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Eye className="h-7 w-7 text-[hsl(var(--geo-blue))]" />
            </div>
            <h3 className="text-xl font-semibold text-foreground dark:text-white mb-3">{t('about.ourVision')}</h3>
            <p className="text-muted-foreground dark:text-gray-400 leading-relaxed">
              {about.vision}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default QuienesSomos;
